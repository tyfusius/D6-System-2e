export interface D6GridStorageBreadcrumbVM {
  readonly id: string;
  readonly label: string;
  readonly current: boolean;
  readonly rootUuid: string;
  readonly spaceId: string;
  readonly containerInstanceId: string | null;
}

export interface D6GridStorageCapacityVM {
  readonly id: "grid" | "weight" | "volume" | "count";
  readonly label: string;
  readonly value: string;
  readonly state: "available" | "warning" | "blocked" | "unknown" | "hidden";
}

export interface D6GridStorageSpaceVM {
  readonly id: string;
  readonly label: string;
  readonly kind: "inventory" | "cargo" | "installation" | "container";
  readonly active: boolean;
  readonly accessibleSummary: string;
  readonly rootUuid: string;
  readonly spaceId: string;
  readonly containerInstanceId: string | null;
}

export interface D6GridStorageItemVM {
  readonly instanceId: string;
  readonly name: string;
  readonly image: string;
  readonly x: number;
  readonly y: number;
  readonly columns: number;
  readonly rows: number;
  readonly gridColumnStart: number;
  readonly gridRowStart: number;
  readonly gridColumnSpan: number;
  readonly gridRowSpan: number;
  readonly rotation: "none" | "quarter-turn";
  readonly disposition: "carried" | "equipped" | "stored" | "installed";
  readonly pinned: boolean;
  readonly container: boolean;
  readonly quantity: number;
  readonly listed: boolean;
  readonly accessibleLabel: string;
  readonly canMove: boolean;
  readonly canPin: boolean;
  readonly canRotate: boolean;
  readonly canOpen: boolean;
  readonly canConfigure: boolean;
  readonly canUse: boolean;
  readonly canEquip: boolean;
  readonly canUnequip: boolean;
  readonly equipLabel: string;
  readonly unavailableReason: string;
}

export interface D6GridStorageUnplacedItemVM {
  readonly instanceId: string;
  readonly documentUuid?: string;
  readonly name: string;
  readonly image: string;
  readonly quantity: number;
  readonly footprintLabel: string;
  readonly measurementState: "known" | "unknown-footprint" | "unknown-limit";
  readonly canPlace: boolean;
  readonly canConfigure: boolean;
  readonly canUse: boolean;
  readonly canEquip: boolean;
  readonly canUnequip: boolean;
  readonly equipLabel: string;
  readonly unavailableReason: string;
}

export interface D6GridStorageSelectionVM {
  readonly instanceId: string;
  readonly title: string;
  readonly placementLabel: string;
  readonly measurementLabel: string;
  readonly pinned: boolean;
  readonly canMove: boolean;
  readonly canPin: boolean;
  readonly canRotate: boolean;
  readonly canOpen: boolean;
  readonly canConfigure: boolean;
  readonly canUse: boolean;
  readonly canEquip: boolean;
  readonly canUnequip: boolean;
  readonly equipLabel: string;
}

export interface D6GridStorageInteractionVM {
  readonly dragState: "idle" | "valid" | "invalid";
  readonly ghostColumnStart: number;
  readonly ghostRowStart: number;
  readonly ghostColumnSpan: number;
  readonly ghostRowSpan: number;
  readonly issue: string;
  readonly liveAnnouncement: string;
}

export interface D6GridStoragePackMoveVM {
  readonly instanceId: string;
  readonly name: string;
  readonly fromLabel: string;
  readonly toLabel: string;
}

export interface D6GridStoragePackPreviewItemVM {
  readonly instanceId: string;
  readonly name: string;
  readonly image: string;
  readonly quantity: number;
  readonly pinned: boolean;
  readonly accessibleLabel: string;
  readonly gridColumnStart: number;
  readonly gridRowStart: number;
  readonly gridColumnSpan: number;
  readonly gridRowSpan: number;
}

export interface D6GridStorageAutoPackVM {
  readonly fixtureId: string;
  readonly outcome: "packed" | "proven-impossible" | "not-found-within-limit";
  readonly title: string;
  readonly summary: string;
  readonly visitedNodes: number;
  readonly pinnedCount: number;
  readonly eligibleCount: number;
  readonly excludedCount: number;
  readonly excludedSummary: string;
  readonly moves: readonly D6GridStoragePackMoveVM[];
  readonly showGridPreview: boolean;
  readonly previewItems: readonly D6GridStoragePackPreviewItemVM[];
  readonly canApply: boolean;
  readonly canUndo: boolean;
  readonly stale: boolean;
}

export interface D6GridStorageWorkspaceVM {
  readonly fixtureId: string;
  readonly rootName: string;
  readonly rootKind: "character" | "vehicle" | "starship" | "storage-location";
  readonly spaceName: string;
  readonly spaceKind: "inventory" | "cargo" | "installation" | "container";
  readonly revision: number | null;
  readonly spaceMode: "grid" | "capacity-only" | null;
  readonly viewMode: "grid" | "list" | "redacted";
  readonly gridConfigured: boolean | null;
  readonly canViewGrid: boolean;
  readonly columns: number | null;
  readonly rows: number | null;
  readonly cellSizeLabel: string;
  readonly gridAriaLabel: string;
  readonly breadcrumbs: readonly D6GridStorageBreadcrumbVM[];
  readonly spaces: readonly D6GridStorageSpaceVM[];
  readonly capacities: readonly D6GridStorageCapacityVM[];
  readonly items: readonly D6GridStorageItemVM[];
  readonly unplaced: readonly D6GridStorageUnplacedItemVM[];
  readonly selection: D6GridStorageSelectionVM | null;
  readonly interaction: D6GridStorageInteractionVM;
  readonly packPreview: D6GridStorageAutoPackVM | null;
  readonly spaceEditor: D6GridStorageSpaceEditorVM | null;
  readonly canEdit: boolean;
  readonly canAutoPack: boolean;
  readonly canUndo: boolean;
  readonly hiddenContentNotice: string;
}

export interface D6GridStorageMovePreviewVM {
  readonly operationId: string;
  readonly itemName: string;
  readonly quantity: number | "all";
  readonly destinationLabel: string;
  readonly coordinateLabel: string;
  readonly allowed: boolean;
  readonly issue: string;
  readonly capacityChanges: readonly D6GridStorageCapacityVM[];
  readonly canApply: boolean;
  readonly applyAction: "applyStorageMove";
  readonly cancelAction: "cancelStorageMove";
  readonly stale: boolean;
}

export interface D6GridStorageEntryPointVM {
  readonly context:
    | "character-sheet"
    | "machine-sheet"
    | "item-sheet"
    | "storage-location-sheet";
  readonly label: string;
  readonly summary: string;
  readonly action: "openStorage";
  readonly canOpen: boolean;
  readonly unavailableReason: string;
}

export interface D6GridStoragePhysicalEditorVM {
  readonly instanceId: string;
  readonly scaleId: string;
  readonly sizePresetId: string;
  readonly sizePresetOptions: Readonly<Record<string, string>>;
  readonly footprintColumns: number | null;
  readonly footprintRows: number | null;
  readonly scaleLabel: string;
  readonly widthMm: number | null;
  readonly depthMm: number | null;
  readonly heightMm: number | null;
  readonly unitWeightGrams: number | null;
  readonly exteriorVolumeMillilitres: number | null;
  readonly maxQuantityPerPlacement: number;
  readonly rotatable: boolean;
  readonly container: boolean;
  readonly interiorConfigured: boolean;
  readonly interiorEditor: D6GridStorageInteriorEditorVM | null;
  readonly fields: {
    readonly sizePresetId: "storagePhysical.sizePresetId";
    readonly footprintColumns: "storagePhysical.footprintColumns";
    readonly footprintRows: "storagePhysical.footprintRows";
    readonly widthMm: "storagePhysical.widthMm";
    readonly depthMm: "storagePhysical.depthMm";
    readonly heightMm: "storagePhysical.heightMm";
    readonly unitWeightGrams: "storagePhysical.unitWeightGrams";
    readonly exteriorVolumeMillilitres: "storagePhysical.exteriorVolumeMillilitres";
    readonly maxQuantityPerPlacement: "storagePhysical.maxQuantityPerPlacement";
    readonly rotatable: "storagePhysical.rotatable";
    readonly container: "storagePhysical.container";
  };
  readonly canEdit: boolean;
  readonly action: "saveStorageConfiguration";
}

export interface D6GridStorageInteriorEditorVM {
  readonly label: string;
  readonly scalePresetId: string;
  readonly scalePresetOptions: Readonly<Record<string, string>>;
  readonly rows: number;
  readonly columns: number;
  readonly cellWidthMm: number | null;
  readonly cellDepthMm: number | null;
  readonly maxAggregateWeightGrams: number | null;
  readonly maxOccupiedVolumeMillilitres: number | null;
  readonly maxDirectChildren: number | null;
  readonly access: "open" | "closed" | "locked";
  readonly fields: {
    readonly label: "storageInterior.label";
    readonly scalePresetId: "storageInterior.scalePresetId";
    readonly rows: "storageInterior.rows";
    readonly columns: "storageInterior.columns";
    readonly cellWidthMm: "storageInterior.cellWidthMm";
    readonly cellDepthMm: "storageInterior.cellDepthMm";
    readonly maxAggregateWeightGrams: "storageInterior.maxAggregateWeightGrams";
    readonly maxOccupiedVolumeMillilitres: "storageInterior.maxOccupiedVolumeMillilitres";
    readonly maxDirectChildren: "storageInterior.maxDirectChildren";
    readonly access: "storageInterior.access";
  };
}

export interface D6GridStorageSpaceEditorVM {
  readonly rootUuid: string;
  readonly spaceId: string;
  readonly containerInstanceId: string | null;
  readonly label: string;
  readonly configuration: "capacity-only" | "grid";
  readonly scalePresetId: string;
  readonly scalePresetOptions: Readonly<Record<string, string>>;
  readonly rows: number;
  readonly columns: number;
  readonly cellWidthMm: number | null;
  readonly cellDepthMm: number | null;
  readonly maxAggregateWeightGrams: number | null;
  readonly maxOccupiedVolumeMillilitres: number | null;
  readonly maxDirectChildren: number | null;
  readonly access: "open" | "closed" | "locked";
  readonly fields: {
    readonly label: "space.label";
    readonly configuration: "space.configuration";
    readonly scalePresetId: "space.scalePresetId";
    readonly rows: "space.rows";
    readonly columns: "space.columns";
    readonly cellWidthMm: "space.cellWidthMm";
    readonly cellDepthMm: "space.cellDepthMm";
    readonly maxAggregateWeightGrams: "space.maxAggregateWeightGrams";
    readonly maxOccupiedVolumeMillilitres: "space.maxOccupiedVolumeMillilitres";
    readonly maxDirectChildren: "space.maxDirectChildren";
    readonly access: "space.access";
  };
  readonly canEdit: boolean;
  readonly action: "saveStorageConfiguration";
  readonly canRemoveRoot: boolean;
  readonly removeAction: "removeStorageRoot";
  readonly removeLabel: string;
  readonly removeHelp: string;
}

export const D6_GRID_STORAGE_APP_CONTRACT = Object.freeze({
  classes: ["d6e2", "d6e2-grid-storage"] as const,
  width: 980,
  height: 720,
  minimumWidth: 640,
  minimumHeight: 480,
});

export const D6_GRID_STORAGE_PARENT_CONTEXT_KEYS = Object.freeze({
  entryPoint: "storageEntryPoint",
  physicalEditor: "storagePhysicalEditor",
  spaceEditor: "storageSpaceEditor",
  workspaceHtml: "storageWorkspaceHtml",
} as const);

const image = "icons/svg/item-bag.svg";
const idleInteraction = Object.freeze<D6GridStorageInteractionVM>({
  dragState: "idle",
  ghostColumnStart: 0,
  ghostRowStart: 0,
  ghostColumnSpan: 0,
  ghostRowSpan: 0,
  issue: "",
  liveAnnouncement: "",
});

export const D6_GRID_STORAGE_DESIGN_FIXTURES = Object.freeze({
  personalCarryList: Object.freeze<D6GridStorageWorkspaceVM>({
    fixtureId: "personal-carry-list",
    rootName: "Mira Venn",
    rootKind: "character",
    spaceName: "Carried inventory",
    spaceKind: "inventory",
    revision: 4,
    spaceMode: "capacity-only",
    viewMode: "list",
    gridConfigured: false,
    canViewGrid: false,
    columns: 0,
    rows: 0,
    cellSizeLabel: "Grid not configured",
    gridAriaLabel: "Carried inventory list",
    breadcrumbs: [
      {
        id: "root",
        label: "Mira Venn",
        current: true,
        rootUuid: "Actor.mira",
        spaceId: "carried",
        containerInstanceId: null,
      },
    ],
    spaces: [
      {
        id: "carried",
        label: "Carried inventory",
        kind: "inventory",
        active: true,
        accessibleSummary: "Capacity-only list",
        rootUuid: "Actor.mira",
        spaceId: "carried",
        containerInstanceId: null,
      },
    ],
    capacities: [
      { id: "grid", label: "Grid", value: "Not configured", state: "unknown" },
      {
        id: "weight",
        label: "Weight",
        value: "7.4 of 12 kg",
        state: "available",
      },
      {
        id: "volume",
        label: "Volume",
        value: "Not limited",
        state: "available",
      },
      { id: "count", label: "Items", value: "5", state: "available" },
    ],
    items: [],
    unplaced: [
      {
        instanceId: "legacy-comlink-a",
        name: "Comlink",
        image,
        quantity: 1,
        footprintLabel: "No grid placement",
        measurementState: "unknown-footprint",
        canPlace: true,
        canConfigure: true,
        canUse: true,
        canEquip: true,
        canUnequip: false,
        equipLabel: "Equip",
        unavailableReason: "",
      },
    ],
    selection: null,
    interaction: idleInteraction,
    packPreview: null,
    spaceEditor: null,
    canEdit: true,
    canAutoPack: false,
    canUndo: false,
    hiddenContentNotice: "",
  }),
  personalBackpack: Object.freeze<D6GridStorageWorkspaceVM>({
    fixtureId: "personal-backpack",
    rootName: "Mira Venn",
    rootKind: "character",
    spaceName: "Field backpack",
    spaceKind: "container",
    revision: 12,
    spaceMode: "grid",
    viewMode: "grid",
    gridConfigured: true,
    canViewGrid: true,
    columns: 8,
    rows: 6,
    cellSizeLabel: "Each cell: 100 × 100 mm",
    gridAriaLabel: "Field backpack, 8 columns by 6 rows",
    breadcrumbs: [
      {
        id: "root",
        label: "Mira Venn",
        current: false,
        rootUuid: "Actor.mira",
        spaceId: "carried",
        containerInstanceId: null,
      },
      {
        id: "backpack",
        label: "Field backpack",
        current: true,
        rootUuid: "Actor.mira",
        spaceId: "interior",
        containerInstanceId: "backpack-a",
      },
    ],
    spaces: [
      {
        id: "backpack",
        label: "Field backpack",
        kind: "container",
        active: true,
        accessibleSummary: "8 by 6 grid",
        rootUuid: "Actor.mira",
        spaceId: "interior",
        containerInstanceId: "backpack-a",
      },
    ],
    capacities: [
      {
        id: "grid",
        label: "Grid",
        value: "12 of 48 cells",
        state: "available",
      },
      {
        id: "weight",
        label: "Weight",
        value: "7.4 of 12 kg",
        state: "available",
      },
      {
        id: "volume",
        label: "Volume",
        value: "Not limited",
        state: "available",
      },
      { id: "count", label: "Items", value: "5 of 12", state: "available" },
    ],
    items: [
      {
        instanceId: "medkit-a",
        name: "Medkit",
        image,
        x: 0,
        y: 0,
        columns: 3,
        rows: 2,
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 3,
        gridRowSpan: 2,
        rotation: "none",
        disposition: "stored",
        pinned: true,
        container: false,
        quantity: 1,
        listed: false,
        accessibleLabel: "Medkit, 3 by 2 cells at column 1 row 1, pinned",
        canMove: true,
        canPin: true,
        canRotate: true,
        canOpen: false,
        canConfigure: true,
        canUse: true,
        canEquip: false,
        canUnequip: false,
        equipLabel: "Equip",
        unavailableReason: "",
      },
      {
        instanceId: "pouch-a",
        name: "Utility pouch",
        image,
        x: 4,
        y: 1,
        columns: 2,
        rows: 3,
        gridColumnStart: 5,
        gridRowStart: 2,
        gridColumnSpan: 2,
        gridRowSpan: 3,
        rotation: "quarter-turn",
        disposition: "stored",
        pinned: false,
        container: true,
        quantity: 1,
        listed: false,
        accessibleLabel:
          "Utility pouch, rotated, 2 by 3 cells at column 5 row 2",
        canMove: true,
        canPin: true,
        canRotate: true,
        canOpen: true,
        canConfigure: true,
        canUse: false,
        canEquip: false,
        canUnequip: false,
        equipLabel: "Equip",
        unavailableReason: "",
      },
    ],
    unplaced: [
      {
        instanceId: "unknown-a",
        name: "Unmeasured salvage",
        image,
        quantity: 2,
        footprintLabel: "Dimensions unknown",
        measurementState: "unknown-footprint",
        canPlace: false,
        canConfigure: true,
        canUse: true,
        canEquip: true,
        canUnequip: false,
        equipLabel: "Equip",
        unavailableReason:
          "Choose a size preset or enter dimensions before placing this item.",
      },
    ],
    selection: null,
    interaction: idleInteraction,
    packPreview: null,
    spaceEditor: null,
    canEdit: true,
    canAutoPack: true,
    canUndo: true,
    hiddenContentNotice: "",
  }),
  machineCargo: Object.freeze<D6GridStorageWorkspaceVM>({
    fixtureId: "machine-cargo",
    rootName: "Wayfarer",
    rootKind: "starship",
    spaceName: "Cargo hold",
    spaceKind: "cargo",
    revision: 44,
    spaceMode: "grid",
    viewMode: "grid",
    gridConfigured: true,
    canViewGrid: true,
    columns: 12,
    rows: 8,
    cellSizeLabel: "Each cell: 500 × 500 mm",
    gridAriaLabel: "Cargo hold, 12 columns by 8 rows",
    breadcrumbs: [
      {
        id: "root",
        label: "Wayfarer cargo",
        current: true,
        rootUuid: "Actor.wayfarer",
        spaceId: "cargo",
        containerInstanceId: null,
      },
    ],
    spaces: [
      {
        id: "cargo",
        label: "Cargo hold",
        kind: "cargo",
        active: true,
        accessibleSummary: "12 by 8 grid",
        rootUuid: "Actor.wayfarer",
        spaceId: "cargo",
        containerInstanceId: null,
      },
      {
        id: "installation",
        label: "Installed components",
        kind: "installation",
        active: false,
        accessibleSummary: "Separate installation space",
        rootUuid: "Actor.wayfarer",
        spaceId: "installation",
        containerInstanceId: null,
      },
    ],
    capacities: [
      {
        id: "grid",
        label: "Grid",
        value: "12 of 96 cells",
        state: "available",
      },
      { id: "weight", label: "Weight", value: "1.8 of 4 t", state: "warning" },
      {
        id: "volume",
        label: "Volume",
        value: "6.2 of 14 m³",
        state: "available",
      },
      { id: "count", label: "Cargo groups", value: "3", state: "available" },
    ],
    items: [
      {
        instanceId: "crate-a",
        name: "Machine-parts crate",
        image,
        x: 1,
        y: 1,
        columns: 4,
        rows: 3,
        gridColumnStart: 2,
        gridRowStart: 2,
        gridColumnSpan: 4,
        gridRowSpan: 3,
        rotation: "none",
        disposition: "stored",
        pinned: false,
        container: true,
        quantity: 1,
        listed: false,
        accessibleLabel:
          "Machine-parts crate, 4 by 3 cargo cells at column 2 row 2",
        canMove: true,
        canPin: true,
        canRotate: true,
        canOpen: true,
        canConfigure: true,
        canUse: false,
        canEquip: false,
        canUnequip: false,
        equipLabel: "Equip",
        unavailableReason: "",
      },
    ],
    unplaced: [],
    selection: null,
    interaction: idleInteraction,
    packPreview: null,
    spaceEditor: null,
    canEdit: true,
    canAutoPack: true,
    canUndo: false,
    hiddenContentNotice:
      "Installed components are managed outside this cargo space.",
  }),
  permissionRedacted: Object.freeze<D6GridStorageWorkspaceVM>({
    fixtureId: "permission-redacted",
    rootName: "Dockside Locker",
    rootKind: "storage-location",
    spaceName: "Shared floor",
    spaceKind: "cargo",
    revision: null,
    spaceMode: null,
    viewMode: "redacted",
    gridConfigured: null,
    canViewGrid: false,
    columns: null,
    rows: null,
    cellSizeLabel: "Storage details hidden",
    gridAriaLabel: "Dockside Locker storage",
    breadcrumbs: [
      {
        id: "root",
        label: "Dockside Locker",
        current: true,
        rootUuid: "Actor.locker",
        spaceId: "",
        containerInstanceId: null,
      },
    ],
    spaces: [],
    capacities: [
      {
        id: "grid",
        label: "Availability",
        value: "Ask an owner",
        state: "hidden",
      },
      { id: "weight", label: "Weight", value: "Hidden", state: "hidden" },
      { id: "volume", label: "Volume", value: "Hidden", state: "hidden" },
      { id: "count", label: "Items", value: "Hidden", state: "hidden" },
    ],
    items: [],
    unplaced: [],
    selection: null,
    interaction: idleInteraction,
    packPreview: null,
    spaceEditor: null,
    canEdit: false,
    canAutoPack: false,
    canUndo: false,
    hiddenContentNotice: "Some storage details are unavailable to you.",
  }),
  autoPackPreview: Object.freeze<D6GridStorageAutoPackVM>({
    fixtureId: "auto-pack-preview",
    outcome: "packed",
    title: "Auto-pack preview",
    summary: "Four eligible items move; two pinned items stay in place.",
    visitedNodes: 186,
    pinnedCount: 2,
    eligibleCount: 4,
    excludedCount: 1,
    excludedSummary: "One unmeasured item remains unplaced.",
    moves: [
      {
        instanceId: "crate-a",
        name: "Machine-parts crate",
        fromLabel: "B2",
        toLabel: "A1",
      },
      {
        instanceId: "tool-a",
        name: "Tool case",
        fromLabel: "Unplaced",
        toLabel: "E1, rotated",
      },
      {
        instanceId: "torch-a",
        name: "Glow torch",
        fromLabel: "C4",
        toLabel: "G1",
      },
      {
        instanceId: "ration-a",
        name: "Ration pack",
        fromLabel: "Unplaced",
        toLabel: "H1",
      },
    ],
    showGridPreview: true,
    previewItems: [
      {
        instanceId: "crate-a",
        name: "Machine-parts crate",
        image: "icons/containers/crates/crate-reinforced-brown.webp",
        quantity: 1,
        pinned: false,
        accessibleLabel: "Machine-parts crate, 4 × 3, 1, 1",
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 4,
        gridRowSpan: 3,
      },
      {
        instanceId: "tool-a",
        name: "Tool case",
        image: "icons/containers/bags/case-simple-leather-brown.webp",
        quantity: 1,
        pinned: false,
        accessibleLabel: "Tool case, 2 × 3, 5, 1",
        gridColumnStart: 5,
        gridRowStart: 1,
        gridColumnSpan: 2,
        gridRowSpan: 3,
      },
      {
        instanceId: "torch-a",
        name: "Glow torch",
        image: "icons/sundries/lights/torch-black.webp",
        quantity: 1,
        pinned: true,
        accessibleLabel: "Glow torch, 1 × 3, 7, 1",
        gridColumnStart: 7,
        gridRowStart: 1,
        gridColumnSpan: 1,
        gridRowSpan: 3,
      },
      {
        instanceId: "ration-a",
        name: "Ration pack",
        image: "icons/consumables/food/plate-ribs-grilled.webp",
        quantity: 3,
        pinned: false,
        accessibleLabel: "Ration pack, 1 × 1, 8, 1",
        gridColumnStart: 8,
        gridRowStart: 1,
        gridColumnSpan: 1,
        gridRowSpan: 1,
      },
    ],
    canApply: true,
    canUndo: false,
    stale: false,
  }),
  autoPackLimited: Object.freeze<D6GridStorageAutoPackVM>({
    fixtureId: "auto-pack-search-limit",
    outcome: "not-found-within-limit",
    title: "Auto-pack stopped",
    summary:
      "No arrangement was found within the 50,000-node search limit. The space may still be packable.",
    visitedNodes: 50_000,
    pinnedCount: 1,
    eligibleCount: 8,
    excludedCount: 0,
    excludedSummary: "",
    moves: [],
    showGridPreview: false,
    previewItems: [],
    canApply: false,
    canUndo: false,
    stale: false,
  }),
  movePreview: Object.freeze<D6GridStorageMovePreviewVM>({
    operationId: "move-preview-a",
    itemName: "Machine-parts crate",
    quantity: "all",
    destinationLabel: "Wayfarer / Cargo hold",
    coordinateLabel: "Column 1, row 1",
    allowed: true,
    issue: "",
    capacityChanges: [
      {
        id: "grid",
        label: "Grid",
        value: "12 of 96 cells",
        state: "available",
      },
      { id: "weight", label: "Weight", value: "1.8 of 4 t", state: "warning" },
    ],
    canApply: true,
    applyAction: "applyStorageMove",
    cancelAction: "cancelStorageMove",
    stale: false,
  }),
  entryPoints: Object.freeze({
    character: Object.freeze<D6GridStorageEntryPointVM>({
      context: "character-sheet",
      label: "Open storage",
      summary: "Carried inventory and containers",
      action: "openStorage",
      canOpen: true,
      unavailableReason: "",
    }),
    machine: Object.freeze<D6GridStorageEntryPointVM>({
      context: "machine-sheet",
      label: "Open cargo storage",
      summary: "Cargo and installed components",
      action: "openStorage",
      canOpen: true,
      unavailableReason: "",
    }),
    item: Object.freeze<D6GridStorageEntryPointVM>({
      context: "item-sheet",
      label: "Configure storage",
      summary: "Size, weight, volume, and container interior",
      action: "openStorage",
      canOpen: true,
      unavailableReason: "",
    }),
    standalone: Object.freeze<D6GridStorageEntryPointVM>({
      context: "storage-location-sheet",
      label: "Open storage",
      summary: "Standalone storage location",
      action: "openStorage",
      canOpen: true,
      unavailableReason: "",
    }),
  }),
  selection: Object.freeze<D6GridStorageSelectionVM>({
    instanceId: "pouch-a",
    title: "Utility pouch",
    placementLabel: "Column 5, row 2 · 2 × 3 squares · rotated",
    measurementLabel: "Personal scale",
    pinned: false,
    canMove: true,
    canPin: true,
    canRotate: true,
    canOpen: true,
    canConfigure: true,
    canUse: false,
    canEquip: false,
    canUnequip: false,
    equipLabel: "Equip",
  }),
  physicalEditor: Object.freeze<D6GridStoragePhysicalEditorVM>({
    instanceId: "unknown-a",
    scaleId: "personal-100",
    sizePresetId: "",
    sizePresetOptions: {
      small: "Small item",
      medium: "Medium item",
      custom: "Custom dimensions",
    },
    footprintColumns: 1,
    footprintRows: 1,
    scaleLabel: "Personal scale · each square is 100 × 100 mm",
    widthMm: null,
    depthMm: null,
    heightMm: null,
    unitWeightGrams: null,
    exteriorVolumeMillilitres: null,
    maxQuantityPerPlacement: 1,
    rotatable: true,
    container: false,
    interiorConfigured: false,
    interiorEditor: null,
    fields: {
      sizePresetId: "storagePhysical.sizePresetId",
      footprintColumns: "storagePhysical.footprintColumns",
      footprintRows: "storagePhysical.footprintRows",
      widthMm: "storagePhysical.widthMm",
      depthMm: "storagePhysical.depthMm",
      heightMm: "storagePhysical.heightMm",
      unitWeightGrams: "storagePhysical.unitWeightGrams",
      exteriorVolumeMillilitres: "storagePhysical.exteriorVolumeMillilitres",
      maxQuantityPerPlacement: "storagePhysical.maxQuantityPerPlacement",
      rotatable: "storagePhysical.rotatable",
      container: "storagePhysical.container",
    },
    canEdit: true,
    action: "saveStorageConfiguration",
  }),
  spaceEditor: Object.freeze<D6GridStorageSpaceEditorVM>({
    rootUuid: "Actor.wayfarer",
    spaceId: "cargo",
    containerInstanceId: null,
    label: "Cargo hold",
    configuration: "grid",
    scalePresetId: "cargo-500",
    scalePresetOptions: {
      "personal-100": "Personal · 100 mm squares",
      "cargo-500": "Cargo · 500 mm squares",
      custom: "Custom scale",
    },
    rows: 8,
    columns: 12,
    cellWidthMm: 500,
    cellDepthMm: 500,
    maxAggregateWeightGrams: 4_000_000,
    maxOccupiedVolumeMillilitres: 14_000_000,
    maxDirectChildren: null,
    access: "open",
    fields: {
      label: "space.label",
      configuration: "space.configuration",
      scalePresetId: "space.scalePresetId",
      rows: "space.rows",
      columns: "space.columns",
      cellWidthMm: "space.cellWidthMm",
      cellDepthMm: "space.cellDepthMm",
      maxAggregateWeightGrams: "space.maxAggregateWeightGrams",
      maxOccupiedVolumeMillilitres: "space.maxOccupiedVolumeMillilitres",
      maxDirectChildren: "space.maxDirectChildren",
      access: "space.access",
    },
    canEdit: true,
    action: "saveStorageConfiguration",
    canRemoveRoot: true,
    removeAction: "removeStorageRoot",
    removeLabel: "Remove storage setup",
    removeHelp:
      "Stops storage tracking while preserving every item, quantity, and owner.",
  }),
});
