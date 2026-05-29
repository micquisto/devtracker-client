export type FilterMode = "current" | "sprint" | "month" | "quarter" | "year";
export interface FilterState {
    mode: FilterMode;
    // sprint path
    sprintYear?: number;
    sprintQuarter?: number; // 1-4
    sprintNum?: number; // 1-7
    // month path
    month?: number; // 0-11
    // quarter path
    quarterYear?: number;
    quarter?: number; // 1-4
    // year path
    year?: number;
  }