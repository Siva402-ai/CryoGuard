import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, TransactionType } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cryoguard_test?schema=public';

if (!dbUrl.includes('cryoguard_test')) {
  throw new Error('Test suite must run against cryoguard_test database only. Refusing execution.');
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

describe('Inventory Ledger Invariant & Stock Constraints', () => {
  let testItemId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Ensure an active admin user exists for test transactions
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', is_active: true } });
    if (!admin) {
      throw new Error('No active admin user found in test database');
    }
    testUserId = admin.id;

    // Create a dedicated inventory test item
    const item = await prisma.inventoryItem.create({
      data: {
        name: 'Invariant Test Valve Seal Kit',
        material: 'PTFE Fluoropolymer',
        unit: 'kits',
        quantity: 10,
        min_quantity: 5,
      },
    });
    testItemId = item.id;

    // Initial opening transaction
    await prisma.inventoryTransaction.create({
      data: {
        item_id: testItemId,
        type: TransactionType.IN,
        quantity: 10,
        reason: 'Opening balance',
        user_id: testUserId,
      },
    });
  });

  afterAll(async () => {
    // Clean up dedicated test item and its transactions (do not touch audit_log)
    await prisma.inventoryTransaction.deleteMany({
      where: { item_id: testItemId },
    });
    await prisma.inventoryItem.delete({
      where: { id: testItemId },
    });
    await prisma.$disconnect();
  });

  it('verifies ledger invariant across all existing inventory items in database', async () => {
    /**
     * Ledger Invariant Formulation:
     * In CryoGuard:
     * - 'IN' transactions add stock (+quantity).
     * - 'OUT' transactions deduct stock (-quantity).
     * - 'ADJUST' transactions store a signed delta (+quantity or -quantity).
     *
     * Invariant:
     * SUM(
     *   CASE
     *     WHEN t.type = 'IN' THEN t.quantity
     *     WHEN t.type = 'OUT' THEN -t.quantity
     *     WHEN t.type = 'ADJUST' THEN t.quantity
     *     ELSE 0
     *   END
     * ) == inventory_items.quantity
     */
    const items = await prisma.inventoryItem.findMany({
      include: {
        transactions: true,
      },
    });

    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      const computedLedgerTotal = item.transactions.reduce((acc, tx) => {
        if (tx.type === TransactionType.IN) {
          return acc + tx.quantity;
        } else if (tx.type === TransactionType.OUT) {
          return acc - tx.quantity;
        } else if (tx.type === TransactionType.ADJUST) {
          return acc + tx.quantity;
        }
        return acc;
      }, 0);

      expect(computedLedgerTotal).toBe(item.quantity);
    }
  });

  it('correctly updates quantity and preserves invariant after IN, OUT, and ADJUST transactions', async () => {
    // 1. IN +5
    await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: testItemId },
        data: { quantity: { increment: 5 } },
      });
      await tx.inventoryTransaction.create({
        data: {
          item_id: testItemId,
          type: TransactionType.IN,
          quantity: 5,
          reason: 'Restock deposit',
          user_id: testUserId,
        },
      });
    });

    // 2. OUT -3
    await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: testItemId },
        data: { quantity: { decrement: 3 } },
      });
      await tx.inventoryTransaction.create({
        data: {
          item_id: testItemId,
          type: TransactionType.OUT,
          quantity: 3,
          reason: 'Maintenance usage',
          user_id: testUserId,
        },
      });
    });

    // 3. ADJUST -2 (ADJUST is stored as signed delta)
    await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: testItemId },
        data: { quantity: { increment: -2 } },
      });
      await tx.inventoryTransaction.create({
        data: {
          item_id: testItemId,
          type: TransactionType.ADJUST,
          quantity: -2,
          reason: 'Cycle count correction (-2 damaged kits)',
          user_id: testUserId,
        },
      });
    });

    // Verify current item quantity = 10 + 5 - 3 - 2 = 10
    const updatedItem = await prisma.inventoryItem.findUnique({
      where: { id: testItemId },
      include: { transactions: true },
    });

    expect(updatedItem).not.toBeNull();
    expect(updatedItem!.quantity).toBe(10);

    const ledgerTotal = updatedItem!.transactions.reduce((acc, tx) => {
      if (tx.type === TransactionType.IN) return acc + tx.quantity;
      if (tx.type === TransactionType.OUT) return acc - tx.quantity;
      if (tx.type === TransactionType.ADJUST) return acc + tx.quantity;
      return acc;
    }, 0);

    expect(ledgerTotal).toBe(updatedItem!.quantity);
  });

  it('rejects an OUT transaction that would cause negative stock and leaves inventory unchanged', async () => {
    const itemBefore = await prisma.inventoryItem.findUnique({
      where: { id: testItemId },
    });
    expect(itemBefore).not.toBeNull();
    const currentStock = itemBefore!.quantity; // 10

    const excessiveOutAmount = currentStock + 5; // 15 > 10

    // Simulate atomic query check: UPDATE WHERE quantity - delta >= 0
    let transactionFailed = false;
    try {
      await prisma.$transaction(async (tx) => {
        const updatedRows: any[] = await tx.$queryRaw`
          UPDATE "inventory_items"
          SET "quantity" = "quantity" - ${excessiveOutAmount}
          WHERE "id" = ${testItemId} AND ("quantity" - ${excessiveOutAmount}) >= 0
          RETURNING *;
        `;

        if (!updatedRows || updatedRows.length === 0) {
          throw new Error('Insufficient stock: transaction would result in negative quantity');
        }

        await tx.inventoryTransaction.create({
          data: {
            item_id: testItemId,
            type: TransactionType.OUT,
            quantity: excessiveOutAmount,
            reason: 'Excessive withdrawal',
            user_id: testUserId,
          },
        });
      });
    } catch (err: any) {
      transactionFailed = true;
      expect(err.message).toContain('Insufficient stock');
    }

    expect(transactionFailed).toBe(true);

    // Assert that stock in database was NOT modified
    const itemAfter = await prisma.inventoryItem.findUnique({
      where: { id: testItemId },
    });
    expect(itemAfter!.quantity).toBe(currentStock);
    expect(itemAfter!.quantity).toBeGreaterThanOrEqual(0);
  });
});
