// 12-point authentication checklist
export const AUTH_CHECKPOINTS = [
  { name: "stitching", label: "Stitching Quality", description: "Consistent stitch pattern, correct thread color, no loose threads" },
  { name: "materials", label: "Material Authenticity", description: "Correct leather, mesh, rubber compounds for this model" },
  { name: "logo_placement", label: "Logo Placement", description: "Correct positioning, size, and print quality of all logos" },
  { name: "glue_patterns", label: "Glue & Construction", description: "Clean glue lines, proper bonding, no excess adhesive" },
  { name: "insole", label: "Insole Printing", description: "Correct font, alignment, and printing quality on insole" },
  { name: "box_label", label: "Box Label Match", description: "Style code, size, and colorway match the shoe" },
  { name: "box_condition", label: "Box Condition", description: "Original box, correct style, proper construction" },
  { name: "laces", label: "Lace Quality", description: "Correct lace type, material, and tips for this model" },
  { name: "uv_test", label: "UV Light Test", description: "Hidden markers and patterns visible under UV match authentic reference" },
  { name: "smell_test", label: "Smell Test", description: "Glue and chemical indicators consistent with authentic production" },
  { name: "weight", label: "Weight Check", description: "Weight within expected range for this model and size" },
  { name: "silhouette", label: "Silhouette Comparison", description: "Overall shape matches authentic reference profile" },
] as const;

// Photo documentation angles
export const AUTH_PHOTO_ANGLES = [
  { angle: "top", label: "Top View" },
  { angle: "left_side", label: "Left Side" },
  { angle: "right_side", label: "Right Side" },
  { angle: "back", label: "Back / Heel" },
  { angle: "front", label: "Front / Toe" },
  { angle: "sole_bottom", label: "Sole (Bottom)" },
  { angle: "sole_side", label: "Sole (Side)" },
  { angle: "insole", label: "Insole" },
  { angle: "tongue", label: "Tongue / Label" },
  { angle: "box_top", label: "Box (Top)" },
  { angle: "box_label", label: "Box Label" },
  { angle: "box_open", label: "Box (Open)" },
] as const;

export type CheckpointName = typeof AUTH_CHECKPOINTS[number]["name"];
export type CheckpointResult = "pass" | "fail" | "warning";
export type PhotoAngle = typeof AUTH_PHOTO_ANGLES[number]["angle"];
export type OverallResult = "passed" | "failed" | "inconclusive";
