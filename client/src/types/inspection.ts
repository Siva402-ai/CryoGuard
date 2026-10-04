export type InspectionResult = 'PASS' | 'NEEDS_ATTENTION' | 'FAIL';

export interface TemplateItem {
  label: string;
  critical: boolean;
}

export interface InspectionTemplate {
  id: string;
  name: string;
  items: TemplateItem[];
}

export interface InspectionItemResult {
  item: string;
  result: 'PASS' | 'FAIL';
  note?: string;
}

export interface InspectionEquipment {
  id: string;
  code: string;
  name: string;
  material: string;
  location: string;
}

export interface InspectionInspector {
  id: string;
  name: string;
  email: string;
}

export interface Inspection {
  id: string;
  equipment_id: string;
  template_id: string;
  inspector_id: string;
  performed_at: string;
  results: InspectionItemResult[];
  overall: InspectionResult;
  findings: string | null;
  corrective_action: string | null;
  equipment?: InspectionEquipment;
  template?: {
    id: string;
    name: string;
    items?: TemplateItem[];
  };
  inspector?: InspectionInspector;
}

export interface CreateInspectionTemplateDto {
  name: string;
  items: TemplateItem[];
}

export interface CreateInspectionDto {
  equipment_id: string;
  template_id: string;
  results: InspectionItemResult[];
  findings?: string;
  corrective_action?: string;
}
