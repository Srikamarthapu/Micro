import {
  Basket,
  Broom,
  Confetti,
  GraduationCap,
  HandHeart,
  Heart,
  House,
  Laptop,
  Leaf,
  PawPrint,
  Truck,
  Wheelchair,
  type Icon,
} from "@phosphor-icons/react";

/**
 * Micro's task catalog.
 *
 * Requesters do not write listings. They pick an authored task and answer a few
 * bounded questions; `composeListing` turns that into the public copy. Every
 * word a neighbor reads therefore comes from this file, so scope, exclusions,
 * completion criteria, and safety boundaries are reviewed data rather than
 * unmoderated user prose. Nothing outside this catalog can be posted.
 *
 * Adding a task means adding an entry here — deliberately, with its own
 * boundary and pay band — not loosening a filter somewhere downstream.
 */

export type TaskCatalogMode = "paid" | "community" | "sponsored";

export type CatalogChoice = {
  id: string;
  label: string;
  /** Sentence appended to the public description. Keep it short and factual. */
  phrase?: string;
  /** Clause appended to "Included in the task". */
  includes?: string;
  /** Clause appended to "Not included". */
  excludes?: string;
  /** Adjustment to the suggested duration, in minutes. */
  minutes?: number;
  /** Adjustment to the suggested helper pay, in dollars. */
  pay?: number;
};

export type CatalogOption = {
  id: string;
  label: string;
  /** Index into `choices` used before the requester touches the control. */
  defaultIndex: number;
  choices: CatalogChoice[];
};

export type CatalogCategory = {
  id: string;
  label: string;
  icon: Icon;
  blurb: string;
  /** Shown at the safety check and stored on the listing. */
  boundary: string;
  /** Baseline exclusion every task in the category carries. */
  baseExcluded: string;
};

export type TaskTemplate = {
  id: string;
  categoryId: string;
  category: string;
  icon: Icon;
  title: string;
  keywords: string[];
  summary: string;
  included: string;
  excluded: string;
  completion: string;
  boundary: string;
  minutes: number;
  pay: number;
  options: CatalogOption[];
  modes: TaskCatalogMode[];
  youthEligible: boolean;
  popularity: number;
};

type TemplateSeed = {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  included: string;
  completion: string;
  minutes: number;
  pay: number;
  options?: CatalogOption[];
  /** Extra exclusion beyond the category baseline. */
  excluded?: string;
  modes?: TaskCatalogMode[];
  youth?: boolean;
  /** Higher sorts earlier and feeds the "Most requested" rail. */
  popularity?: number;
};

const allModes: TaskCatalogMode[] = ["paid", "community", "sponsored"];

function option(id: string, label: string, defaultIndex: number, choices: CatalogChoice[]): CatalogOption {
  return { id, label, defaultIndex, choices };
}

/* -------------------------------------------------------------------------- */
/* Shared option presets                                                      */
/* -------------------------------------------------------------------------- */

const opt = {
  yardSize: option("yardSize", "Yard size", 1, [
    { id: "small", label: "Small", phrase: "It is a small yard.", minutes: -15, pay: -5 },
    { id: "medium", label: "Medium", phrase: "It is a medium yard." },
    { id: "large", label: "Large", phrase: "It is a large yard.", minutes: 45, pay: 16 },
  ]),
  bagCount: option("bagCount", "Expected bags", 1, [
    { id: "few", label: "1–2 bags", phrase: "Expect about 1–2 bags of debris.", minutes: -10, pay: -4 },
    { id: "some", label: "3–5 bags", phrase: "Expect about 3–5 bags of debris." },
    { id: "many", label: "6+ bags", phrase: "Expect six or more bags of debris.", minutes: 30, pay: 12 },
  ]),
  tools: option("tools", "Tools", 0, [
    { id: "provided", label: "I provide them", phrase: "Hand tools are provided.", includes: "Use of the provided hand tools." },
    { id: "bring", label: "Helper brings own", phrase: "Please bring your own hand tools.", includes: "Helper's own hand tools.", pay: 6 },
  ]),
  greenBin: option("greenBin", "Green bin", 0, [
    { id: "yes", label: "Available", phrase: "The green bin is available on site.", includes: "Loading debris into the green bin." },
    { id: "no", label: "Not available", phrase: "There is no green bin, so bag the debris and leave it at the side of the house.", includes: "Bagging debris and stacking it at the side of the house.", excludes: "No hauling debris off the property." },
  ]),
  roomCount: option("roomCount", "How much space", 1, [
    { id: "one", label: "One room", phrase: "This covers one room.", minutes: -15, pay: -5 },
    { id: "few", label: "2–3 rooms", phrase: "This covers two to three rooms." },
    { id: "floor", label: "Whole floor", phrase: "This covers a full floor.", minutes: 45, pay: 16 },
  ]),
  floorLevel: option("floorLevel", "Access", 0, [
    { id: "ground", label: "Ground floor", phrase: "Everything is on the ground floor." },
    { id: "stairs", label: "Up stairs", phrase: "The space is up a flight of stairs.", minutes: 10, pay: 5 },
    { id: "elevator", label: "Elevator building", phrase: "The building has an elevator.", minutes: 10 },
  ]),
  boxCount: option("boxCount", "How many boxes", 1, [
    { id: "small", label: "Under 10", phrase: "There are fewer than ten boxes.", minutes: -20, pay: -8 },
    { id: "medium", label: "10–25", phrase: "There are roughly ten to twenty-five boxes." },
    { id: "large", label: "25+", phrase: "There are more than twenty-five boxes.", minutes: 60, pay: 24 },
  ]),
  stairs: option("stairs", "Stairs", 0, [
    { id: "none", label: "No stairs", phrase: "There are no stairs on the route." },
    { id: "one", label: "One flight", phrase: "There is one flight of stairs on the route.", minutes: 15, pay: 6 },
    { id: "several", label: "Two or more", phrase: "There are two or more flights of stairs on the route.", minutes: 30, pay: 14 },
  ]),
  vehicle: option("vehicle", "Vehicle", 0, [
    { id: "mine", label: "I have one", phrase: "A vehicle is available on site.", excludes: "No use of the helper's own vehicle." },
    { id: "car", label: "Helper's car", phrase: "Please bring a car with a usable trunk or hatch.", includes: "Use of the helper's car.", pay: 10 },
    { id: "truck", label: "Helper's truck", phrase: "Please bring a pickup or van.", includes: "Use of the helper's pickup or van.", pay: 22 },
  ]),
  supplies: option("supplies", "Supplies", 0, [
    { id: "provided", label: "I provide them", phrase: "Cleaning supplies are provided.", includes: "Use of the provided supplies." },
    { id: "bring", label: "Helper brings own", phrase: "Please bring your own standard supplies.", includes: "Helper's own standard supplies.", pay: 8 },
  ]),
  distanceBand: option("distanceBand", "Distance", 0, [
    { id: "close", label: "Within 1 mile", phrase: "The stop is within a mile." },
    { id: "mid", label: "1–3 miles", phrase: "The stop is one to three miles away.", minutes: 15, pay: 6 },
    { id: "far", label: "3–6 miles", phrase: "The stop is three to six miles away.", minutes: 30, pay: 14 },
  ]),
  itemLoad: option("itemLoad", "How much to carry", 1, [
    { id: "light", label: "A few items", phrase: "It is a few light items.", minutes: -10, pay: -4 },
    { id: "bag", label: "One full bag", phrase: "It is about one full bag." },
    { id: "several", label: "Several bags", phrase: "It is several bags.", minutes: 15, pay: 8 },
  ]),
  prepaid: option("prepaid", "Payment", 0, [
    { id: "online", label: "Prepaid online", phrase: "The order is already paid for online.", excludes: "No cash, cards, or spending on the helper's behalf." },
    { id: "counter", label: "Prepaid at counter", phrase: "The order is already paid for and waiting at the counter.", excludes: "No cash, cards, or spending on the helper's behalf." },
  ]),
  petSize: option("petSize", "Size", 1, [
    { id: "small", label: "Small", phrase: "The animal is small." },
    { id: "medium", label: "Medium", phrase: "The animal is medium sized." },
    { id: "large", label: "Large", phrase: "The animal is large.", pay: 6 },
  ]),
  petCount: option("petCount", "How many", 0, [
    { id: "one", label: "One", phrase: "There is one animal." },
    { id: "two", label: "Two", phrase: "There are two animals.", minutes: 10, pay: 6 },
    { id: "more", label: "Three or more", phrase: "There are three or more animals.", minutes: 20, pay: 14 },
  ]),
  leashBehavior: option("leashBehavior", "On a leash", 0, [
    { id: "calm", label: "Calm", phrase: "The dog is calm on a leash." },
    { id: "pulls", label: "Pulls sometimes", phrase: "The dog pulls sometimes and needs a firm hold." },
    { id: "slow", label: "Needs slow handling", phrase: "The dog is nervous and needs slow, quiet handling.", minutes: 10 },
  ]),
  deviceCount: option("deviceCount", "How many devices", 0, [
    { id: "one", label: "One", phrase: "There is one device to work on." },
    { id: "two", label: "Two", phrase: "There are two devices to work on.", minutes: 20, pay: 10 },
    { id: "more", label: "Three or more", phrase: "There are three or more devices to work on.", minutes: 40, pay: 20 },
  ]),
  pace: option("pace", "Pace", 0, [
    { id: "beginner", label: "Beginner pace", phrase: "Please go slowly and explain each step.", minutes: 15 },
    { id: "comfortable", label: "Comfortable pace", phrase: "A normal working pace is fine." },
  ]),
  mobility: option("mobility", "Mobility", 0, [
    { id: "unaided", label: "Walks unaided", phrase: "The person walks unaided." },
    { id: "walker", label: "Uses a walker", phrase: "The person uses a walker and sets the pace.", minutes: 15 },
    { id: "wheelchair", label: "Uses a wheelchair", phrase: "The person uses a wheelchair and directs any assistance.", minutes: 15 },
  ]),
  guestCount: option("guestCount", "Expected guests", 0, [
    { id: "small", label: "Under 20", phrase: "Fewer than twenty people are expected." },
    { id: "medium", label: "20–50", phrase: "Twenty to fifty people are expected.", minutes: 30, pay: 12 },
    { id: "large", label: "50+", phrase: "More than fifty people are expected.", minutes: 60, pay: 26 },
  ]),
  eventPhase: option("eventPhase", "Which shift", 0, [
    { id: "setup", label: "Setup only", phrase: "This is the setup shift." },
    { id: "cleanup", label: "Cleanup only", phrase: "This is the cleanup shift." },
    { id: "both", label: "Setup and cleanup", phrase: "This covers both the setup and the cleanup shift.", minutes: 60, pay: 26 },
  ]),
  gradeBand: option("gradeBand", "Grade level", 1, [
    { id: "elementary", label: "Elementary", phrase: "The student is in elementary school." },
    { id: "middle", label: "Middle school", phrase: "The student is in middle school." },
    { id: "high", label: "High school", phrase: "The student is in high school." },
  ]),
  sessionLength: option("sessionLength", "Session length", 1, [
    { id: "short", label: "45 min", phrase: "Plan for a forty-five minute session.", minutes: -15 },
    { id: "standard", label: "60 min", phrase: "Plan for a one hour session." },
    { id: "long", label: "90 min", phrase: "Plan for a ninety minute session.", minutes: 30, pay: 14 },
  ]),
  shiftLength: option("shiftLength", "Shift length", 0, [
    { id: "one", label: "1 hour", phrase: "The shift is about one hour." },
    { id: "two", label: "2 hours", phrase: "The shift is about two hours.", minutes: 60 },
    { id: "three", label: "3 hours", phrase: "The shift is about three hours.", minutes: 120 },
  ]),
  language: option("language", "Spoken language", 0, [
    { id: "english", label: "English", phrase: "The conversation will be in English." },
    { id: "spanish", label: "Spanish", phrase: "The conversation will be in Spanish." },
    { id: "cantonese", label: "Cantonese", phrase: "The conversation will be in Cantonese." },
    { id: "vietnamese", label: "Vietnamese", phrase: "The conversation will be in Vietnamese." },
  ]),
};

/* -------------------------------------------------------------------------- */
/* Category assembly                                                          */
/* -------------------------------------------------------------------------- */

const categories: CatalogCategory[] = [];
const templates: TaskTemplate[] = [];

function category(definition: CatalogCategory, seeds: TemplateSeed[]) {
  categories.push(definition);
  for (const seed of seeds) {
    templates.push({
      id: seed.id,
      categoryId: definition.id,
      category: definition.label,
      icon: definition.icon,
      title: seed.title,
      keywords: seed.keywords,
      summary: seed.summary,
      included: seed.included,
      excluded: seed.excluded ? `${definition.baseExcluded} ${seed.excluded}` : definition.baseExcluded,
      completion: seed.completion,
      boundary: definition.boundary,
      minutes: seed.minutes,
      pay: seed.pay,
      options: seed.options ?? [],
      modes: seed.modes ?? allModes,
      youthEligible: seed.youth ?? false,
      popularity: seed.popularity ?? 0,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Yard & garden                                                              */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "yard",
    label: "Yard & garden",
    icon: Leaf,
    blurb: "Ground-level outdoor upkeep.",
    boundary: "Ground level only — no ladders, roof access, tree climbing, power tools, or pesticide handling.",
    baseExcluded: "No ladder work, roof access, tree climbing, chemical spraying, or work above shoulder height.",
  },
  [
    { id: "yard-leaves", title: "Front yard leaf cleanup", keywords: ["leaves", "rake", "fall", "autumn"], summary: "Rake and bag the fallen leaves across the front yard.", included: "Raking the front yard and bagging what comes up.", completion: "The front yard is clear and the bags are where we agreed.", minutes: 60, pay: 28, options: [opt.yardSize, opt.bagCount, opt.tools, opt.greenBin], youth: true, popularity: 96 },
    { id: "yard-weeds", title: "Weed the garden beds", keywords: ["weeding", "beds", "garden", "overgrown"], summary: "Pull weeds from the garden beds by hand and clear the roots.", included: "Hand weeding the beds and clearing the pulled growth.", completion: "The beds are visibly clear of weeds and the debris is bagged.", minutes: 60, pay: 26, options: [opt.yardSize, opt.tools, opt.greenBin], youth: true, popularity: 88 },
    { id: "yard-mow", title: "Mow a small lawn", keywords: ["mow", "lawn", "grass", "cut"], summary: "Mow the lawn at an even height and sweep the clippings off the walkway.", included: "Mowing the lawn and sweeping the hard surfaces afterwards.", excluded: "No edging with a string trimmer and no mowing on a slope.", completion: "The lawn is evenly cut and the walkway is swept.", minutes: 60, pay: 32, options: [opt.yardSize, opt.tools], popularity: 84 },
    { id: "yard-hedge", title: "Trim a low hedge", keywords: ["hedge", "trim", "shears", "shrub"], summary: "Trim the hedge back to an even line with hand shears.", included: "Trimming the hedge at shoulder height or below and clearing the clippings.", excluded: "No hedge above shoulder height and no powered trimmers.", completion: "The hedge is even and the clippings are cleared.", minutes: 60, pay: 30, options: [opt.tools, opt.greenBin], popularity: 72 },
    { id: "yard-lavender", title: "Cut back lavender or perennials", keywords: ["lavender", "prune", "perennial", "cut back"], summary: "Cut back the lavender and perennials so the path stays clear.", included: "Cutting back the marked plants and clearing the trimmings.", completion: "The plants are cut back and the path is clear.", minutes: 45, pay: 24, options: [opt.tools, opt.greenBin], youth: true, popularity: 66 },
    { id: "yard-water", title: "Water plants while away", keywords: ["watering", "plants", "vacation", "away"], summary: "Water the outdoor plants on the schedule left by the door.", included: "Watering each plant on the written schedule.", excluded: "No entry beyond the yard and no key handling.", completion: "Every plant on the list is watered and you confirm in the thread.", minutes: 30, pay: 18, youth: true, popularity: 70 },
    { id: "yard-planting", title: "Plant starts or bulbs", keywords: ["planting", "bulbs", "seedlings", "starts"], summary: "Plant the starts or bulbs in the prepared bed at the spacing marked.", included: "Digging the small holes, planting, and watering in.", completion: "Everything is planted at the marked spacing and watered.", minutes: 60, pay: 28, options: [opt.tools], youth: true, popularity: 58 },
    { id: "yard-mulch", title: "Spread mulch or compost", keywords: ["mulch", "compost", "bark", "spread"], summary: "Spread the delivered mulch evenly across the beds with a rake.", included: "Moving mulch from the pile and raking it level in the beds.", completion: "The beds are evenly covered and the pile area is swept.", minutes: 90, pay: 42, options: [opt.yardSize, opt.tools], popularity: 54 },
    { id: "yard-sweep", title: "Sweep the walkway and driveway", keywords: ["sweep", "driveway", "walkway", "path"], summary: "Sweep the walkway and driveway and bag the debris.", included: "Sweeping the hard surfaces and bagging what comes up.", completion: "The walkway and driveway are clear.", minutes: 30, pay: 18, options: [opt.tools], youth: true, popularity: 62 },
    { id: "yard-bins", title: "Take bins out and back", keywords: ["bins", "trash", "garbage", "recycling"], summary: "Bring the bins to the curb on collection day and return them afterwards.", included: "Moving the bins to the curb and back to their spot.", completion: "The bins are back in place after collection.", minutes: 15, pay: 15, youth: true, popularity: 78 },
    { id: "yard-cleanup", title: "General yard tidy-up", keywords: ["tidy", "cleanup", "yard", "general"], summary: "Tidy the yard: clear fallen debris, straighten pots, and bag loose litter.", included: "Clearing debris, straightening pots, and bagging litter.", completion: "The yard looks tidy and the debris is bagged.", minutes: 60, pay: 28, options: [opt.yardSize, opt.greenBin], youth: true, popularity: 68 },
    { id: "yard-pots", title: "Repot or refresh planters", keywords: ["pots", "planters", "repot", "soil"], summary: "Repot the marked planters with the soil provided.", included: "Repotting the marked planters and watering them in.", completion: "The marked planters are repotted and watered.", minutes: 45, pay: 24, youth: true, popularity: 46 },
    { id: "yard-veg", title: "Help in the vegetable garden", keywords: ["vegetable", "garden", "harvest", "beds"], summary: "Work through the vegetable beds: weed, tie back, and harvest what is ready.", included: "Weeding the beds, tying back growth, and harvesting ripe produce.", completion: "The beds are weeded and the harvest is set aside as agreed.", minutes: 60, pay: 28, options: [opt.tools], youth: true, popularity: 42 },
    { id: "yard-fence-clear", title: "Clear growth off a fence line", keywords: ["fence", "vines", "overgrowth", "clear"], summary: "Cut back the growth crowding the fence line at ground level.", included: "Cutting back growth along the fence and clearing the trimmings.", completion: "The fence line is clear and the trimmings are bagged.", minutes: 75, pay: 34, options: [opt.tools, opt.greenBin], popularity: 44 },
    { id: "yard-patio", title: "Clean off a patio or deck", keywords: ["patio", "deck", "scrub", "outdoor"], summary: "Sweep and scrub the patio or deck by hand, then rinse it down.", included: "Sweeping, hand scrubbing, and rinsing the surface.", excluded: "No pressure washer and no deck sealing or staining.", completion: "The surface is swept, scrubbed, and rinsed.", minutes: 60, pay: 30, options: [opt.supplies], popularity: 48 },
    { id: "yard-furniture", title: "Set out or store patio furniture", keywords: ["patio furniture", "cushions", "store", "season"], summary: "Move the patio furniture in or out for the season and wipe it down.", included: "Moving the furniture and wiping it down.", completion: "The furniture is where we agreed and wiped down.", minutes: 45, pay: 24, youth: true, popularity: 40 },
    { id: "yard-hose", title: "Coil hoses and tidy the shed", keywords: ["hose", "shed", "tools", "organize"], summary: "Coil the hoses and put the garden tools back in order in the shed.", included: "Coiling hoses and organizing the tools already in the shed.", completion: "The hoses are coiled and the shed is in order.", minutes: 45, pay: 22, youth: true, popularity: 36 },
    { id: "yard-gravel", title: "Rake gravel or bark level", keywords: ["gravel", "bark", "rake", "level"], summary: "Rake the gravel or bark back to an even level across the area.", included: "Raking the loose material level.", completion: "The area is raked even.", minutes: 45, pay: 24, options: [opt.tools], youth: true, popularity: 32 },
    { id: "yard-storm", title: "Clear debris after a storm", keywords: ["storm", "branches", "debris", "wind"], summary: "Clear the fallen branches and debris left in the yard after the storm.", included: "Gathering ground-level branches and debris and stacking or bagging them.", excluded: "No chainsaw work, no cutting standing trees, and nothing hanging overhead.", completion: "The ground-level debris is cleared and stacked or bagged.", minutes: 75, pay: 36, options: [opt.greenBin], popularity: 50 },
    { id: "yard-compost", title: "Turn and sort the compost", keywords: ["compost", "turn", "bin", "sort"], summary: "Turn the compost pile and sort out anything that does not belong.", included: "Turning the pile and removing non-compostable items.", completion: "The pile is turned and the stray items are set aside.", minutes: 45, pay: 22, popularity: 26 },
    { id: "yard-path", title: "Pull weeds from path cracks", keywords: ["cracks", "pavers", "path", "weeds"], summary: "Pull the weeds growing up through the path or driveway cracks.", included: "Hand pulling weeds from the cracks and sweeping after.", excluded: "No weed killer or chemical treatment of any kind.", completion: "The cracks are clear and the path is swept.", minutes: 45, pay: 22, youth: true, popularity: 38 },
    { id: "yard-birdbath", title: "Clean a birdbath or garden feature", keywords: ["birdbath", "fountain", "feature", "clean"], summary: "Empty, scrub, and refill the birdbath or small garden feature.", included: "Emptying, scrubbing, and refilling the feature.", completion: "The feature is clean and refilled.", minutes: 30, pay: 16, options: [opt.supplies], youth: true, popularity: 24 },
    { id: "yard-seedstart", title: "Start seed trays for the season", keywords: ["seeds", "trays", "start", "propagate"], summary: "Fill and sow the seed trays with the seed and soil provided.", included: "Filling trays, sowing the seed, labelling, and watering in.", completion: "The trays are sown, labelled, and watered.", minutes: 45, pay: 22, youth: true, popularity: 22 },
    { id: "yard-garden-share", title: "Share a garden work hour", keywords: ["volunteer", "garden", "together", "hour"], summary: "Spend an hour helping in the garden alongside the requester.", included: "Working alongside the requester on ground-level garden tasks.", completion: "The hour is finished and both people confirm in the thread.", minutes: 60, pay: 0, modes: ["community"], youth: true, popularity: 44 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Home help                                                                  */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "home",
    label: "Home help",
    icon: House,
    blurb: "Small indoor jobs, no trade work.",
    boundary: "No electrical, gas, plumbing, roofing, or structural work, and nothing that needs a licence or a ladder above shoulder height.",
    baseExcluded: "No electrical, gas, plumbing, or structural work, and no ladder use above shoulder height.",
  },
  [
    { id: "home-flatpack", title: "Assemble flat-pack furniture", keywords: ["ikea", "assembly", "flat pack", "furniture"], summary: "Assemble the flat-pack furniture from the instructions in the box.", included: "Assembling the item and flattening the packaging afterwards.", excluded: "No wall anchoring, drilling into walls, or electrical connection.", completion: "The item is assembled, stable, and the packaging is flattened.", minutes: 90, pay: 45, options: [opt.floorLevel, opt.tools], popularity: 94 },
    { id: "home-shelf", title: "Hang a picture or light shelf", keywords: ["hang", "picture", "shelf", "mount"], summary: "Hang the pictures or light shelf at the marked height using the fixings provided.", included: "Hanging the marked items level with the fixings provided.", excluded: "No heavy mounts, no TV mounting, and no work above shoulder height.", completion: "Each item is hung level where it was marked.", minutes: 45, pay: 26, options: [opt.tools], popularity: 74 },
    { id: "home-furniture-move", title: "Move furniture between rooms", keywords: ["move", "furniture", "rearrange", "shift"], summary: "Move the marked furniture to its new spot in the house.", included: "Carrying and repositioning the marked furniture.", completion: "Each piece is in its new spot and the floor is undamaged.", minutes: 60, pay: 34, options: [opt.stairs], popularity: 80 },
    { id: "home-closet", title: "Organize a closet or wardrobe", keywords: ["closet", "wardrobe", "organize", "declutter"], summary: "Sort and reorganize the closet into the categories the requester describes on site.", included: "Sorting, folding, and returning items to the closet in order.", excluded: "No throwing anything away without the requester confirming it first.", completion: "The closet is sorted and anything set aside is left for the requester to review.", minutes: 90, pay: 40, popularity: 68 },
    { id: "home-declutter", title: "Declutter a room together", keywords: ["declutter", "sort", "tidy", "room"], summary: "Work through the room with the requester, sorting what stays, what is donated, and what is recycled.", included: "Sorting into keep, donate, and recycle piles with the requester present.", excluded: "No decisions about what to discard without the requester.", completion: "The piles are sorted and the room is walkable.", minutes: 90, pay: 40, options: [opt.roomCount], popularity: 64 },
    { id: "home-lightbulb", title: "Swap out reachable light bulbs", keywords: ["bulb", "lamp", "light", "replace"], summary: "Replace the bulbs in the lamps and fixtures that can be reached from the floor.", included: "Swapping bulbs that are reachable standing on the floor.", excluded: "No ceiling fixtures needing a ladder and no wiring or fitting changes.", completion: "Each reachable bulb is replaced and working.", minutes: 30, pay: 18, youth: true, popularity: 52 },
    { id: "home-battery", title: "Change batteries in detectors and clocks", keywords: ["battery", "smoke detector", "clock", "replace"], summary: "Replace the batteries in the reachable detectors, clocks, and remotes.", included: "Swapping batteries in reachable devices and testing them.", excluded: "No detector removal, rewiring, or work needing a ladder.", completion: "Each device has a fresh battery and tests as working.", minutes: 30, pay: 18, popularity: 48 },
    { id: "home-filter", title: "Swap a water or air filter", keywords: ["filter", "water", "air", "replace"], summary: "Replace the water or air filter with the cartridge already bought.", included: "Removing the old filter and fitting the new one.", excluded: "No work on the furnace, boiler, or any gas appliance.", completion: "The new filter is fitted and the old one is set aside.", minutes: 30, pay: 20, popularity: 42 },
    { id: "home-blinds", title: "Adjust or rehang curtains and blinds", keywords: ["curtains", "blinds", "hang", "adjust"], summary: "Rehang or adjust the curtains and blinds on the existing fittings.", included: "Rehanging the fabric or blinds on the fittings already in place.", excluded: "No new brackets, drilling, or work above shoulder height.", completion: "The curtains and blinds hang straight and open freely.", minutes: 45, pay: 24, popularity: 38 },
    { id: "home-boxes-attic", title: "Bring storage boxes up or down", keywords: ["storage", "boxes", "attic", "basement"], summary: "Move the storage boxes between the storage space and the room where they are needed.", included: "Carrying the marked boxes and stacking them where asked.", excluded: "No attic or crawlspace entry and no ladder use.", completion: "The boxes are stacked where we agreed.", minutes: 45, pay: 26, options: [opt.stairs, opt.boxCount], popularity: 44 },
    { id: "home-paint-touch", title: "Touch up paint on a wall", keywords: ["paint", "touch up", "wall", "scuff"], summary: "Touch up the marked scuffs with the paint already on hand.", included: "Painting the marked spots and cleaning the brush.", excluded: "No full-room painting, no sanding of old paint, and no work above shoulder height.", completion: "The marked spots are painted and the area is left clean.", minutes: 60, pay: 28, options: [opt.supplies], popularity: 40 },
    { id: "home-assembly-bike", title: "Assemble or tune a bike", keywords: ["bike", "bicycle", "assemble", "tune"], summary: "Assemble the bike from the box or make basic adjustments to a bike already built.", included: "Assembly, seat and handlebar adjustment, and tyre inflation.", excluded: "No brake or gear repair beyond simple adjustment.", completion: "The bike rolls, brakes hold, and the seat is set for the rider.", minutes: 60, pay: 34, popularity: 46 },
    { id: "home-furniture-disassemble", title: "Take apart furniture for disposal", keywords: ["disassemble", "break down", "furniture", "dispose"], summary: "Take the marked furniture apart and stack the pieces for disposal.", included: "Disassembling the item and stacking the parts.", completion: "The item is apart and the pieces are stacked where we agreed.", minutes: 60, pay: 30, options: [opt.tools], popularity: 36 },
    { id: "home-pantry", title: "Organize a pantry or kitchen cupboard", keywords: ["pantry", "cupboard", "kitchen", "organize"], summary: "Empty, wipe, and reorganize the pantry or cupboards, checking dates as you go.", included: "Wiping the shelves and returning items in order.", excluded: "No discarding food without the requester confirming it.", completion: "The shelves are wiped and everything is back in order.", minutes: 60, pay: 28, options: [opt.supplies], youth: true, popularity: 50 },
    { id: "home-laundry", title: "Wash and fold a laundry load", keywords: ["laundry", "wash", "fold", "clothes"], summary: "Run the laundry through the machines on site and fold it.", included: "Washing, drying, and folding the load.", excluded: "No dry cleaning, no ironing, and no handling of soiled medical linen.", completion: "The load is washed, dried, and folded.", minutes: 90, pay: 32, youth: true, popularity: 56 },
    { id: "home-dishes", title: "Clear and wash the dishes", keywords: ["dishes", "kitchen", "wash", "clean up"], summary: "Clear the kitchen, wash the dishes, and wipe the counters down.", included: "Washing up, loading the dishwasher, and wiping counters.", completion: "The sink is empty and the counters are wiped.", minutes: 45, pay: 22, options: [opt.supplies], youth: true, popularity: 54 },
    { id: "home-meal-prep", title: "Prep ingredients for the week", keywords: ["meal prep", "chop", "cook", "kitchen"], summary: "Prep and portion the ingredients the requester has bought for the week.", included: "Washing, chopping, and portioning into the containers provided.", excluded: "No cooking for anyone with a medical diet and no shopping.", completion: "The ingredients are prepped and stored in the containers provided.", minutes: 90, pay: 40, popularity: 34 },
    { id: "home-recycling", title: "Break down and sort recycling", keywords: ["recycling", "cardboard", "sort", "flatten"], summary: "Flatten the cardboard and sort the recycling into the right bins.", included: "Flattening boxes and sorting recycling into the correct bins.", completion: "The recycling is sorted and the boxes are flattened.", minutes: 30, pay: 16, youth: true, popularity: 44 },
    { id: "home-mail", title: "Sort a backlog of mail and paper", keywords: ["mail", "paper", "sort", "shred"], summary: "Sort the mail backlog into keep, act on, and recycle, with the requester nearby.", included: "Sorting paper into the three piles the requester sets.", excluded: "No opening of financial or medical mail and no shredding without approval.", completion: "The backlog is sorted into the agreed piles.", minutes: 60, pay: 26, popularity: 28 },
    { id: "home-holiday-decor", title: "Put up or take down decorations", keywords: ["decorations", "holiday", "lights", "seasonal"], summary: "Put up or take down the indoor decorations and box them properly.", included: "Hanging or removing reachable decorations and boxing them.", excluded: "No roof or exterior lights and no ladder use above shoulder height.", completion: "The decorations are up, or down and boxed, as agreed.", minutes: 60, pay: 28, youth: true, popularity: 32 },
    { id: "home-guest-room", title: "Get a guest room ready", keywords: ["guest", "bedroom", "make bed", "prepare"], summary: "Make up the guest room: fresh bedding, clear surfaces, and towels set out.", included: "Changing the bedding, clearing surfaces, and setting out towels.", completion: "The room is made up and the towels are out.", minutes: 45, pay: 24, youth: true, popularity: 26 },
    { id: "home-neighbor-hour", title: "Lend an hour of household help", keywords: ["volunteer", "household", "hour", "help"], summary: "Spend an hour on small household tasks alongside the requester.", included: "Working through small indoor tasks with the requester present.", completion: "The hour is finished and both people confirm in the thread.", minutes: 60, pay: 0, modes: ["community"], youth: true, popularity: 40 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Moving & hauling                                                           */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "moving",
    label: "Moving & hauling",
    icon: Truck,
    blurb: "Lifting, loading, and drop-offs.",
    boundary: "Two-person lifts only for anything heavy — no solo lifting over 50 lb, no piano or safe moves, and no hazardous or unidentified materials.",
    baseExcluded: "No solo lifting over 50 lb, no pianos or safes, and no hazardous, chemical, or unidentified materials.",
  },
  [
    { id: "move-load", title: "Load a van or truck", keywords: ["load", "van", "truck", "moving day"], summary: "Load the packed boxes and furniture into the vehicle.", included: "Carrying items to the vehicle and stacking them safely.", completion: "Everything on the list is loaded and the load is stable.", minutes: 120, pay: 70, options: [opt.boxCount, opt.stairs, opt.vehicle], popularity: 90 },
    { id: "move-unload", title: "Unload and carry in", keywords: ["unload", "carry in", "moving", "delivery"], summary: "Unload the vehicle and carry everything into the rooms it belongs in.", included: "Unloading and placing boxes in the marked rooms.", completion: "The vehicle is empty and each box is in its marked room.", minutes: 120, pay: 70, options: [opt.boxCount, opt.stairs], popularity: 86 },
    { id: "move-pack", title: "Pack boxes for a move", keywords: ["pack", "boxes", "wrap", "moving"], summary: "Pack and label the boxes with the materials already on site.", included: "Wrapping, packing, and labelling boxes.", excluded: "No packing of documents, medication, or valuables without the requester present.", completion: "The boxes are packed, labelled, and stacked.", minutes: 120, pay: 60, options: [opt.boxCount, opt.roomCount], popularity: 72 },
    { id: "move-unpack", title: "Unpack after a move", keywords: ["unpack", "boxes", "settle in", "new home"], summary: "Unpack the boxes room by room and break down the empties.", included: "Unpacking boxes and flattening the empties.", completion: "The marked boxes are unpacked and the empties are flattened.", minutes: 120, pay: 58, options: [opt.boxCount, opt.roomCount], popularity: 60 },
    { id: "move-dump", title: "Take a load to the dump or transfer station", keywords: ["dump", "haul", "transfer station", "junk"], summary: "Load the marked items and take them to the transfer station.", included: "Loading the marked items and the drop-off run.", excluded: "No paint, batteries, electronics, tyres, or anything needing hazardous-waste handling.", completion: "The items are dropped off and the receipt is shared in the thread.", minutes: 120, pay: 75, options: [opt.vehicle, opt.stairs], popularity: 74 },
    { id: "move-donation", title: "Drop off a donation load", keywords: ["donation", "goodwill", "charity", "drop off"], summary: "Take the bagged donation items to the drop-off point.", included: "Loading the bags and the drop-off run.", completion: "The donation is dropped off and the receipt is shared in the thread.", minutes: 75, pay: 40, options: [opt.vehicle, opt.itemLoad], popularity: 66 },
    { id: "move-recycle-run", title: "Run cardboard and e-waste to recycling", keywords: ["recycling", "cardboard", "ewaste", "drop off"], summary: "Take the flattened cardboard and accepted recycling to the drop-off centre.", included: "Loading the flattened material and the drop-off run.", excluded: "No batteries, paint, or hazardous waste.", completion: "The load is dropped off and confirmed in the thread.", minutes: 75, pay: 38, options: [opt.vehicle], popularity: 44 },
    { id: "move-single-item", title: "Move one large item", keywords: ["couch", "sofa", "mattress", "single item"], summary: "Move one large item to its new location with a second person on the lift.", included: "A two-person lift and the move to the agreed spot.", excluded: "No solo lifting of the item at any point.", completion: "The item is in place and undamaged.", minutes: 60, pay: 45, options: [opt.stairs, opt.vehicle], popularity: 78 },
    { id: "move-storage", title: "Move items into storage", keywords: ["storage", "unit", "locker", "store"], summary: "Move the marked items into the storage unit and stack them for access.", included: "Loading, transporting, and stacking in the unit.", completion: "Everything is in the unit and stacked so the aisle stays clear.", minutes: 120, pay: 68, options: [opt.boxCount, opt.vehicle], popularity: 48 },
    { id: "move-pickup", title: "Pick up a marketplace purchase", keywords: ["marketplace", "pickup", "collect", "facebook"], summary: "Collect a purchased item from the seller's address and bring it back.", included: "Collection and delivery of the already-paid item.", excluded: "No cash exchange, no negotiating, and no inspection disputes on the requester's behalf.", completion: "The item is delivered and confirmed in the thread.", minutes: 75, pay: 42, options: [opt.vehicle, opt.distanceBand], popularity: 62 },
    { id: "move-furniture-swap", title: "Swap furniture between two homes", keywords: ["swap", "exchange", "two homes", "furniture"], summary: "Move furniture between two addresses agreed in the thread.", included: "Loading, transport, and placement at both ends.", completion: "Both items are in place at their new addresses.", minutes: 120, pay: 72, options: [opt.vehicle, opt.stairs], popularity: 34 },
    { id: "move-garage", title: "Clear out a garage", keywords: ["garage", "clear out", "sort", "junk"], summary: "Work through the garage sorting into keep, donate, and dispose piles.", included: "Sorting and stacking into the three agreed piles.", excluded: "No decisions about what to discard without the requester.", completion: "The garage is sorted into the agreed piles.", minutes: 150, pay: 78, popularity: 52 },
    { id: "move-basement", title: "Clear out a basement or shed", keywords: ["basement", "shed", "clear", "storage"], summary: "Clear and sort the basement or shed with the requester directing.", included: "Carrying items out, sorting, and restacking.", excluded: "No crawlspace entry and no unidentified chemical containers.", completion: "The space is sorted and the walkway is clear.", minutes: 150, pay: 78, options: [opt.stairs], popularity: 40 },
    { id: "move-boxes-supply", title: "Collect moving boxes and supplies", keywords: ["boxes", "supplies", "collect", "moving"], summary: "Collect the reserved moving boxes and supplies and bring them over.", included: "Pickup and delivery of the reserved supplies.", excluded: "No cash, cards, or spending on the helper's behalf.", completion: "The supplies are delivered and confirmed in the thread.", minutes: 60, pay: 32, options: [opt.vehicle, opt.prepaid], popularity: 30 },
    { id: "move-assembly-day", title: "Reassemble furniture at the new place", keywords: ["reassemble", "rebuild", "furniture", "new place"], summary: "Reassemble the furniture that was taken apart for the move.", included: "Reassembling the marked pieces and clearing the packaging.", excluded: "No wall anchoring or electrical connection.", completion: "Each piece is reassembled and stable.", minutes: 90, pay: 48, options: [opt.tools], popularity: 38 },
    { id: "move-yard-sale", title: "Set up or pack down a yard sale", keywords: ["yard sale", "garage sale", "tables", "setup"], summary: "Set out the tables and stock for the sale, or pack it all down afterwards.", included: "Carrying, arranging, and packing down the sale items.", excluded: "No handling of the cash box or sales on the requester's behalf.", completion: "The sale is set up, or packed down, as agreed.", minutes: 90, pay: 42, options: [opt.eventPhase], youth: true, popularity: 32 },
    { id: "move-plant-move", title: "Move heavy planters or garden pots", keywords: ["planters", "pots", "heavy", "garden"], summary: "Reposition the heavy planters with a second person on the lift.", included: "A two-person lift and repositioning of the marked planters.", completion: "The planters are in their new spots and intact.", minutes: 60, pay: 36, popularity: 24 },
    { id: "move-neighbor-lift", title: "Lend a hand on moving day", keywords: ["volunteer", "moving day", "help", "lift"], summary: "Join the moving effort for a shift as a second pair of hands.", included: "Carrying, loading, and stacking alongside the requester.", completion: "The shift is finished and both people confirm in the thread.", minutes: 120, pay: 0, modes: ["community"], popularity: 46 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Cleaning                                                                   */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "cleaning",
    label: "Cleaning",
    icon: Broom,
    blurb: "Everyday cleaning, standard supplies.",
    boundary: "Standard household products only — no mixing chemicals, no biohazard or pest cleanup, and no exterior work needing a ladder.",
    baseExcluded: "No chemical mixing, biohazard or pest cleanup, mould remediation, or exterior work needing a ladder.",
  },
  [
    { id: "clean-general", title: "General home clean", keywords: ["clean", "tidy", "house", "general"], summary: "Clean through the home: surfaces, floors, and visible dust.", included: "Wiping surfaces, vacuuming, mopping, and emptying bins.", completion: "The agreed rooms are cleaned and the bins are empty.", minutes: 120, pay: 60, options: [opt.roomCount, opt.supplies], popularity: 92 },
    { id: "clean-kitchen", title: "Deep clean the kitchen", keywords: ["kitchen", "deep clean", "counters", "scrub"], summary: "Deep clean the kitchen: counters, sink, hob, cupboard fronts, and floor.", included: "Scrubbing surfaces, the sink, the hob, and the floor.", excluded: "No oven interior chemicals unless the product is provided and labelled.", completion: "The kitchen surfaces and floor are clean.", minutes: 90, pay: 48, options: [opt.supplies], popularity: 80 },
    { id: "clean-bathroom", title: "Clean the bathrooms", keywords: ["bathroom", "toilet", "shower", "scrub"], summary: "Clean the bathrooms: toilet, shower, sink, mirror, and floor.", included: "Scrubbing the fixtures, the mirror, and the floor.", completion: "The bathrooms are cleaned and dry.", minutes: 60, pay: 38, options: [opt.supplies], popularity: 78 },
    { id: "clean-floors", title: "Vacuum and mop the floors", keywords: ["vacuum", "mop", "floors", "hoover"], summary: "Vacuum and mop through the floors on the agreed level.", included: "Vacuuming and mopping the hard and carpeted floors.", completion: "The floors are vacuumed and mopped.", minutes: 60, pay: 32, options: [opt.roomCount, opt.supplies], youth: true, popularity: 70 },
    { id: "clean-windows", title: "Clean the inside of windows", keywords: ["windows", "glass", "wipe", "streaks"], summary: "Clean the inside of the windows and the sills on the agreed level.", included: "Cleaning interior glass and wiping the sills.", excluded: "No exterior glass, no upper storeys, and no ladder use.", completion: "The interior glass is clear and the sills are wiped.", minutes: 60, pay: 34, options: [opt.supplies], popularity: 56 },
    { id: "clean-moveout", title: "Move-out clean", keywords: ["move out", "end of tenancy", "empty", "deep"], summary: "Clean the empty home end to end before handover.", included: "Cleaning all surfaces, fixtures, floors, and interior cupboards.", completion: "The home is clean throughout and ready for handover.", minutes: 180, pay: 110, options: [opt.roomCount, opt.supplies], popularity: 66 },
    { id: "clean-movein", title: "Move-in clean", keywords: ["move in", "new home", "before boxes", "clean"], summary: "Clean the empty home before the boxes arrive.", included: "Cleaning surfaces, fixtures, cupboard interiors, and floors.", completion: "The home is clean and ready for the move-in.", minutes: 150, pay: 95, options: [opt.roomCount, opt.supplies], popularity: 50 },
    { id: "clean-post-event", title: "Clean up after an event", keywords: ["party", "after", "event", "cleanup"], summary: "Clear and clean the space after the event.", included: "Clearing dishes and rubbish, wiping surfaces, and sweeping.", completion: "The space is cleared, wiped, and swept.", minutes: 90, pay: 46, options: [opt.guestCount, opt.supplies], youth: true, popularity: 54 },
    { id: "clean-fridge", title: "Clean out the fridge or freezer", keywords: ["fridge", "freezer", "defrost", "clean"], summary: "Empty, wipe, and restock the fridge or freezer, checking dates as you go.", included: "Emptying, wiping the shelves, and restocking.", excluded: "No discarding food without the requester confirming it.", completion: "The shelves are wiped and the contents are back in order.", minutes: 60, pay: 30, options: [opt.supplies], popularity: 44 },
    { id: "clean-oven", title: "Clean the oven and hob", keywords: ["oven", "hob", "stove", "grease"], summary: "Clean the oven interior and the hob with the product provided.", included: "Cleaning the oven interior, racks, and hob.", excluded: "No self-clean cycles, no gas fittings, and no dismantling of the appliance.", completion: "The oven interior, racks, and hob are clean.", minutes: 75, pay: 42, options: [opt.supplies], popularity: 46 },
    { id: "clean-dust", title: "Dust and wipe surfaces", keywords: ["dust", "wipe", "surfaces", "shelves"], summary: "Dust and wipe the surfaces, shelves, and skirting on the agreed level.", included: "Dusting and wiping reachable surfaces.", completion: "The surfaces are dusted and wiped.", minutes: 45, pay: 26, options: [opt.roomCount, opt.supplies], youth: true, popularity: 48 },
    { id: "clean-car", title: "Wash and vacuum a car", keywords: ["car", "wash", "vacuum", "valet"], summary: "Wash the car outside and vacuum the interior.", included: "Exterior wash and interior vacuum.", excluded: "No engine bay, no polishing compounds, and no pressure washer.", completion: "The car is washed outside and vacuumed inside.", minutes: 75, pay: 40, options: [opt.supplies], youth: true, popularity: 52 },
    { id: "clean-garage-sweep", title: "Sweep out a garage or basement", keywords: ["garage", "sweep", "basement", "dust"], summary: "Sweep out the garage or basement and bag the debris.", included: "Sweeping the floor and bagging the debris.", completion: "The floor is swept and the debris is bagged.", minutes: 60, pay: 30, youth: true, popularity: 34 },
    { id: "clean-laundry-room", title: "Clean the laundry or utility room", keywords: ["laundry room", "utility", "clean", "lint"], summary: "Clean the laundry room: surfaces, floor, and the reachable lint traps.", included: "Wiping surfaces, clearing reachable lint, and mopping.", excluded: "No dryer vent work behind the appliance and no appliance moving alone.", completion: "The room is wiped and the floor is mopped.", minutes: 45, pay: 26, options: [opt.supplies], popularity: 24 },
    { id: "clean-entry", title: "Clean the entryway and stairs", keywords: ["entry", "hallway", "stairs", "clean"], summary: "Clean the entryway and stairs: sweep, mop, and wipe the handrails.", included: "Sweeping, mopping, and wiping the handrails.", completion: "The entry and stairs are swept, mopped, and wiped.", minutes: 45, pay: 26, options: [opt.supplies], youth: true, popularity: 30 },
    { id: "clean-shared-space", title: "Clean a shared community space", keywords: ["volunteer", "community", "shared", "clean"], summary: "Help clean a shared community space during a scheduled shift.", included: "Cleaning the shared space alongside the other volunteers.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community"], youth: true, popularity: 42 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Errands & pickup                                                           */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "errands",
    label: "Errands & pickup",
    icon: Basket,
    blurb: "Prepaid pickups and short runs.",
    boundary: "Prepaid orders only — no cash handling, no account or card access, no unplanned purchases, no passengers, and no prescription pickup.",
    baseExcluded: "No cash handling, card or account access, unplanned purchases, passengers, or prescription pickup.",
  },
  [
    { id: "err-grocery", title: "Pick up a prepaid grocery order", keywords: ["grocery", "shopping", "pickup", "order"], summary: "Collect the prepaid grocery order and bring it to the door.", included: "Collecting the order and carrying it to the door.", completion: "The order is delivered and confirmed in the thread.", minutes: 45, pay: 24, options: [opt.distanceBand, opt.itemLoad, opt.prepaid], youth: true, popularity: 95 },
    { id: "err-package", title: "Collect a package from the locker or depot", keywords: ["package", "parcel", "locker", "depot"], summary: "Collect the package using the code shared in the thread and bring it over.", included: "Collection and delivery of the package.", excluded: "No opening of the package and no signing for anything beyond the named collection.", completion: "The package is delivered and confirmed in the thread.", minutes: 45, pay: 22, options: [opt.distanceBand, opt.itemLoad], youth: true, popularity: 82 },
    { id: "err-mail", title: "Drop off mail or a package", keywords: ["mail", "post", "ship", "drop off"], summary: "Take the prepaid, labelled parcels to the post office or drop box.", included: "The drop-off run for pre-labelled parcels.", excluded: "No buying postage and no unlabelled parcels.", completion: "The parcels are dropped off and the receipt is shared in the thread.", minutes: 30, pay: 18, options: [opt.distanceBand], youth: true, popularity: 74 },
    { id: "err-pharmacy-nonrx", title: "Pick up prepaid household items", keywords: ["household", "supplies", "pickup", "store"], summary: "Collect the prepaid household order and bring it over.", included: "Collection and delivery of the prepaid order.", completion: "The order is delivered and confirmed in the thread.", minutes: 45, pay: 22, options: [opt.distanceBand, opt.prepaid], youth: true, popularity: 58 },
    { id: "err-food", title: "Pick up a prepaid takeout order", keywords: ["takeout", "food", "restaurant", "pickup"], summary: "Collect the prepaid takeout order and bring it straight over.", included: "Collection and prompt delivery of the order.", completion: "The order is delivered and confirmed in the thread.", minutes: 30, pay: 18, options: [opt.distanceBand, opt.prepaid], youth: true, popularity: 76 },
    { id: "err-library", title: "Return or collect library items", keywords: ["library", "books", "return", "hold"], summary: "Return the library items, or collect the holds under the name in the thread.", included: "The library return or hold collection.", excluded: "No paying of fines and no account changes.", completion: "The items are returned or delivered, confirmed in the thread.", minutes: 30, pay: 18, options: [opt.distanceBand], youth: true, popularity: 46 },
    { id: "err-dropoff-donation", title: "Drop off a small donation bag", keywords: ["donation", "drop off", "charity", "bag"], summary: "Take the donation bag to the drop-off point.", included: "The drop-off run for the bagged donation.", completion: "The donation is dropped off and confirmed in the thread.", minutes: 30, pay: 18, options: [opt.distanceBand, opt.itemLoad], youth: true, popularity: 48 },
    { id: "err-drycleaning", title: "Drop off or collect dry cleaning", keywords: ["dry cleaning", "laundry", "collect", "drop off"], summary: "Drop off or collect the prepaid dry cleaning under the name in the thread.", included: "The drop-off or collection run.", completion: "The items are dropped off or delivered, confirmed in the thread.", minutes: 30, pay: 18, options: [opt.distanceBand, opt.prepaid], youth: true, popularity: 40 },
    { id: "err-hardware", title: "Pick up a prepaid hardware order", keywords: ["hardware", "diy", "pickup", "store"], summary: "Collect the prepaid hardware order and bring it over.", included: "Collection and delivery of the prepaid order.", excluded: "No propane, fuel, or pressurised cylinders.", completion: "The order is delivered and confirmed in the thread.", minutes: 45, pay: 24, options: [opt.distanceBand, opt.vehicle, opt.prepaid], popularity: 44 },
    { id: "err-farmers", title: "Pick up a prepaid farmers market box", keywords: ["farmers market", "csa", "box", "produce"], summary: "Collect the prepaid market box and bring it over.", included: "Collection and delivery of the box.", completion: "The box is delivered and confirmed in the thread.", minutes: 45, pay: 22, options: [opt.distanceBand, opt.itemLoad], youth: true, popularity: 36 },
    { id: "err-return", title: "Return an online order to the store", keywords: ["return", "online order", "store", "refund"], summary: "Return the labelled item to the store using the return code in the thread.", included: "The return drop-off with the provided label or code.", excluded: "No handling of refunds, cards, or store credit.", completion: "The return is accepted and the receipt is shared in the thread.", minutes: 45, pay: 22, options: [opt.distanceBand], youth: true, popularity: 54 },
    { id: "err-key", title: "Deliver keys or documents between neighbors", keywords: ["keys", "documents", "deliver", "hand off"], summary: "Carry the sealed envelope or keys between the two people agreed in the thread.", included: "Hand-to-hand delivery of the sealed item.", excluded: "No opening of the envelope and no leaving items unattended.", completion: "The item is handed over and both people confirm in the thread.", minutes: 30, pay: 18, options: [opt.distanceBand], popularity: 32 },
    { id: "err-recycling-dropoff", title: "Take bottles and cans to redemption", keywords: ["bottles", "cans", "redemption", "recycle"], summary: "Take the sorted bottles and cans to the redemption centre.", included: "The drop-off run for the sorted containers.", excluded: "No handling of the refund on the requester's behalf.", completion: "The containers are dropped off and confirmed in the thread.", minutes: 45, pay: 22, options: [opt.distanceBand, opt.vehicle], youth: true, popularity: 30 },
    { id: "err-plant-supplies", title: "Pick up a prepaid garden or pet order", keywords: ["garden centre", "pet store", "pickup", "supplies"], summary: "Collect the prepaid garden or pet order and bring it over.", included: "Collection and delivery of the prepaid order.", completion: "The order is delivered and confirmed in the thread.", minutes: 45, pay: 22, options: [opt.distanceBand, opt.itemLoad, opt.prepaid], youth: true, popularity: 28 },
    { id: "err-form-dropoff", title: "Drop off forms at a public office", keywords: ["forms", "office", "city hall", "drop off"], summary: "Deliver the sealed forms to the public office named in the thread.", included: "The drop-off of the sealed envelope.", excluded: "No filling in of forms, no fees paid, and no speaking on the requester's behalf.", completion: "The forms are dropped off and the receipt is shared in the thread.", minutes: 45, pay: 22, options: [opt.distanceBand], popularity: 22 },
    { id: "err-multi-stop", title: "Run two prepaid stops in one trip", keywords: ["multi stop", "errands", "trip", "combined"], summary: "Complete the two prepaid stops listed in the thread on one trip.", included: "Both prepaid collections and the delivery.", completion: "Both stops are complete and confirmed in the thread.", minutes: 75, pay: 38, options: [opt.distanceBand, opt.vehicle, opt.prepaid], popularity: 42 },
    { id: "err-flowers", title: "Pick up and deliver a prepaid gift", keywords: ["flowers", "gift", "deliver", "surprise"], summary: "Collect the prepaid flowers or gift and deliver them to the address in the thread.", included: "Collection and hand delivery of the prepaid gift.", completion: "The gift is delivered and confirmed in the thread.", minutes: 45, pay: 24, options: [opt.distanceBand, opt.prepaid], youth: true, popularity: 26 },
    { id: "err-water-delivery", title: "Carry heavy items in from the curb", keywords: ["heavy", "curb", "carry in", "delivery"], summary: "Carry the delivered items from the curb into the house.", included: "Carrying the delivered items inside and placing them where asked.", completion: "The items are inside and placed as agreed.", minutes: 30, pay: 20, options: [opt.stairs, opt.itemLoad], popularity: 38 },
    { id: "err-wait-delivery", title: "Wait in for a delivery window", keywords: ["wait", "delivery", "window", "in person"], summary: "Wait at the property during the delivery window and accept the delivery.", included: "Waiting on site and accepting the delivery.", excluded: "No unsupervised access beyond the entry area and no signing for high-value goods.", completion: "The delivery is accepted and confirmed in the thread.", minutes: 120, pay: 45, popularity: 34 },
    { id: "err-neighbor-run", title: "Add a neighbor's pickup to your trip", keywords: ["volunteer", "errand", "trip", "neighbor"], summary: "Add a neighbor's prepaid pickup to a trip you are already making.", included: "The prepaid collection and hand-off.", completion: "The item is handed over and both people confirm in the thread.", minutes: 30, pay: 0, modes: ["community"], youth: true, popularity: 50 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Pets & animals                                                             */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "pets",
    label: "Pets & animals",
    icon: PawPrint,
    blurb: "Walks, feeding, and pet care.",
    boundary: "No veterinary or medical care, no medication dosing, no aggressive or unfamiliar animals, and no off-leash handling.",
    baseExcluded: "No veterinary or medical care, medication dosing, off-leash handling, or animals with a bite history.",
  },
  [
    { id: "pet-walk", title: "Walk a dog", keywords: ["dog", "walk", "leash", "exercise"], summary: "Take the dog out on the usual route and back.", included: "The on-leash walk and fresh water on return.", completion: "The dog is home, settled, and you confirm in the thread.", minutes: 45, pay: 22, options: [opt.petSize, opt.petCount, opt.leashBehavior], youth: true, popularity: 93 },
    { id: "pet-feed", title: "Feed pets while away", keywords: ["feed", "away", "vacation", "pet sitting"], summary: "Feed and water the pets on the schedule left out.", included: "Feeding, fresh water, and a quick welfare check.", completion: "The pets are fed and you confirm with a note in the thread.", minutes: 30, pay: 18, options: [opt.petCount], youth: true, popularity: 84 },
    { id: "pet-litter", title: "Clean a litter box or hutch", keywords: ["litter", "cat", "hutch", "clean"], summary: "Clean out the litter box or hutch and replace the bedding.", included: "Emptying, cleaning, and refilling with the supplies provided.", completion: "The box or hutch is clean and refilled.", minutes: 30, pay: 18, options: [opt.petCount, opt.supplies], youth: true, popularity: 58 },
    { id: "pet-daytime", title: "Midday pet visit", keywords: ["midday", "visit", "check in", "pet"], summary: "Visit at midday for a walk, a feed, and a short play.", included: "The visit, the on-leash walk, feeding, and a short play.", completion: "The visit is done and you leave a note in the thread.", minutes: 45, pay: 26, options: [opt.petSize, opt.leashBehavior], youth: true, popularity: 70 },
    { id: "pet-play", title: "Play and exercise time in the yard", keywords: ["play", "exercise", "yard", "fetch"], summary: "Spend the session playing with the pet in the enclosed yard.", included: "Supervised play in the enclosed yard and fresh water after.", excluded: "No leaving the enclosed area at any point.", completion: "The session is finished and the pet is settled indoors.", minutes: 45, pay: 22, options: [opt.petSize], youth: true, popularity: 46 },
    { id: "pet-groom-brush", title: "Brush and basic grooming", keywords: ["brush", "groom", "coat", "shedding"], summary: "Brush the pet out with the tools provided.", included: "Brushing and clearing up the loose hair.", excluded: "No clipping, nail trimming, bathing, or ear cleaning.", completion: "The coat is brushed out and the area is cleared.", minutes: 45, pay: 24, options: [opt.petSize], youth: true, popularity: 40 },
    { id: "pet-bath", title: "Bathe a dog", keywords: ["bath", "wash", "dog", "shampoo"], summary: "Bathe the dog with the shampoo provided and towel dry.", included: "The bath, towel drying, and cleaning the area after.", excluded: "No medicated washes and no clipping.", completion: "The dog is washed, dried, and the area is clean.", minutes: 60, pay: 32, options: [opt.petSize], popularity: 34 },
    { id: "pet-vet-transport", title: "Drive a pet to a routine appointment", keywords: ["vet", "appointment", "drive", "transport"], summary: "Take the pet in its carrier to the routine appointment and back.", included: "Transport in the carrier and hand-off at the clinic.", excluded: "No decisions about treatment, no payment, and no emergency transport.", completion: "The pet is home and you confirm in the thread.", minutes: 90, pay: 45, options: [opt.vehicle, opt.distanceBand], popularity: 42 },
    { id: "pet-supplies", title: "Restock pet food and supplies", keywords: ["pet food", "supplies", "restock", "pickup"], summary: "Collect the prepaid pet supplies and put them away.", included: "Collection, delivery, and putting the supplies away.", excluded: "No cash, cards, or unplanned purchases.", completion: "The supplies are delivered and put away.", minutes: 45, pay: 24, options: [opt.distanceBand, opt.prepaid], youth: true, popularity: 30 },
    { id: "pet-tank", title: "Feed fish and top up a tank", keywords: ["fish", "aquarium", "tank", "feed"], summary: "Feed the fish and top up the tank following the note left out.", included: "Feeding and topping up to the marked line.", excluded: "No full water changes, filter servicing, or chemical dosing.", completion: "The fish are fed and the tank is topped up.", minutes: 20, pay: 15, youth: true, popularity: 24 },
    { id: "pet-birds", title: "Care for birds or small animals", keywords: ["birds", "rabbit", "hamster", "small pets"], summary: "Feed, water, and clean up for the small animals on the schedule left out.", included: "Feeding, fresh water, and spot cleaning the enclosure.", excluded: "No handling outside the enclosure unless the note says so.", completion: "The animals are fed and the enclosure is spot cleaned.", minutes: 30, pay: 18, options: [opt.petCount], youth: true, popularity: 26 },
    { id: "pet-chickens", title: "Look after backyard chickens", keywords: ["chickens", "coop", "eggs", "backyard"], summary: "Feed the chickens, collect the eggs, and secure the coop.", included: "Feeding, egg collection, and closing up the coop.", completion: "The birds are fed, the eggs are collected, and the coop is closed.", minutes: 30, pay: 20, youth: true, popularity: 22 },
    { id: "pet-overnight-visit", title: "Evening pet check while away", keywords: ["evening", "check", "away", "overnight"], summary: "Make the evening visit: feed, walk, and settle the pets for the night.", included: "The evening feed, the on-leash walk, and settling the pets.", excluded: "No overnight stay in the home.", completion: "The pets are settled and you confirm in the thread.", minutes: 45, pay: 28, options: [opt.petCount, opt.leashBehavior], popularity: 44 },
    { id: "pet-yard-waste", title: "Clean up the yard after a dog", keywords: ["poop", "yard", "clean up", "dog waste"], summary: "Clear the dog waste from the yard and bag it.", included: "Clearing and bagging the waste.", completion: "The yard is clear and the waste is bagged.", minutes: 30, pay: 20, options: [opt.yardSize], popularity: 36 },
    { id: "pet-crate", title: "Assemble a crate, gate, or pet bed", keywords: ["crate", "gate", "pet bed", "assemble"], summary: "Assemble the pet crate, gate, or bed from the box.", included: "Assembly and flattening the packaging.", excluded: "No drilling into walls or door frames.", completion: "The item is assembled and stable.", minutes: 45, pay: 26, options: [opt.tools], popularity: 20 },
    { id: "pet-neighbor-walk", title: "Walk a neighbor's dog as a favor", keywords: ["volunteer", "dog", "walk", "neighbor"], summary: "Take a neighbor's dog out on its usual route as a favor.", included: "The on-leash walk and fresh water on return.", completion: "The dog is home and both people confirm in the thread.", minutes: 45, pay: 0, modes: ["community"], youth: true, popularity: 48 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Tech help                                                                  */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "tech",
    label: "Tech help",
    icon: Laptop,
    blurb: "Setup and patient walkthroughs.",
    boundary: "No passwords, banking, or account credentials are ever shared, no remote access, and no purchases on the requester's behalf.",
    baseExcluded: "No password or credential sharing, banking or financial account access, remote-control software, or purchases on the requester's behalf.",
  },
  [
    { id: "tech-phone-setup", title: "Set up a new phone", keywords: ["phone", "setup", "new", "transfer"], summary: "Set up the new phone and move data across with the owner present the whole time.", included: "Guided setup and data transfer with the owner entering their own credentials.", completion: "The phone is set up and the owner confirms it works.", minutes: 75, pay: 40, options: [opt.pace], popularity: 88 },
    { id: "tech-wifi", title: "Fix or set up home wifi", keywords: ["wifi", "internet", "router", "network"], summary: "Get the home wifi working and connect the devices that need it.", included: "Router placement, network setup, and reconnecting devices.", excluded: "No cabling through walls and no work on the provider's account.", completion: "The wifi works and the listed devices are connected.", minutes: 75, pay: 45, options: [opt.deviceCount, opt.pace], popularity: 90 },
    { id: "tech-printer", title: "Set up or fix a printer", keywords: ["printer", "scanner", "wireless", "setup"], summary: "Get the printer working and connected to the devices that need it.", included: "Printer setup, driver install, and a test print.", completion: "A test page prints from each listed device.", minutes: 60, pay: 34, options: [opt.deviceCount], popularity: 68 },
    { id: "tech-tv", title: "Set up a TV or streaming box", keywords: ["tv", "streaming", "roku", "setup"], summary: "Set up the TV or streaming box and get the apps signed in by the owner.", included: "Physical setup, input configuration, and app setup with the owner signing in.", excluded: "No wall mounting and no new subscriptions.", completion: "The TV plays from each source the owner asked for.", minutes: 60, pay: 36, options: [opt.pace], popularity: 64 },
    { id: "tech-computer-slow", title: "Clean up a slow computer", keywords: ["slow", "computer", "cleanup", "storage"], summary: "Free up space and tidy the startup items on a slow computer.", included: "Clearing temporary files, reviewing startup items, and applying updates.", excluded: "No deleting personal files without the owner watching and no registry tools.", completion: "The computer starts faster and the owner confirms nothing is missing.", minutes: 75, pay: 42, options: [opt.pace], popularity: 62 },
    { id: "tech-backup", title: "Set up a backup", keywords: ["backup", "photos", "cloud", "drive"], summary: "Set up a backup of the photos and documents to the drive or service the owner already has.", included: "Configuring the backup and running the first copy.", excluded: "No new paid storage plans and no credential handling.", completion: "The first backup completes and the owner can see the files.", minutes: 75, pay: 42, popularity: 54 },
    { id: "tech-photos", title: "Organize and back up photos", keywords: ["photos", "organize", "albums", "sort"], summary: "Sort the photos into albums and get them backed up.", included: "Sorting into albums and confirming the backup.", excluded: "No deleting photos without the owner watching.", completion: "The albums are organized and the backup is confirmed.", minutes: 90, pay: 44, popularity: 40 },
    { id: "tech-video-call", title: "Set up video calling", keywords: ["video call", "zoom", "facetime", "family"], summary: "Set up video calling and practise a call together.", included: "Setup, a practice call, and a written step-by-step card.", completion: "A practice call connects and the owner has the written steps.", minutes: 60, pay: 32, options: [opt.pace], popularity: 58 },
    { id: "tech-email", title: "Sort out email or calendar", keywords: ["email", "calendar", "inbox", "sync"], summary: "Get email and calendar working across the owner's devices.", included: "Configuring the apps with the owner entering their own credentials.", completion: "Email and calendar sync on each listed device.", minutes: 60, pay: 36, options: [opt.deviceCount], popularity: 44 },
    { id: "tech-smart-home", title: "Set up a smart speaker or plug", keywords: ["smart home", "alexa", "speaker", "plug"], summary: "Set up the smart speaker or plug and connect it to the home network.", included: "Device setup and connection to the existing network.", excluded: "No electrical work beyond plugging into an existing outlet.", completion: "The device responds and the owner can control it.", minutes: 45, pay: 30, options: [opt.deviceCount], popularity: 42 },
    { id: "tech-security-check", title: "Review privacy and security settings", keywords: ["privacy", "security", "settings", "safety"], summary: "Go through the privacy and security settings together with the owner driving.", included: "Reviewing settings and explaining each change before it is made.", excluded: "No changing passwords for the owner and no account recovery on their behalf.", completion: "The settings are reviewed and the owner made each change themselves.", minutes: 60, pay: 38, options: [opt.pace], popularity: 46 },
    { id: "tech-scam-check", title: "Talk through a suspicious message", keywords: ["scam", "phishing", "suspicious", "fraud"], summary: "Sit down together and work out whether a message or call is a scam.", included: "Reviewing the message and explaining the warning signs.", excluded: "No contacting the sender, no clicking links, and no financial action of any kind.", completion: "The message is assessed and the next step is written down.", minutes: 45, pay: 30, popularity: 50 },
    { id: "tech-app-help", title: "Learn an app step by step", keywords: ["app", "learn", "tutorial", "how to"], summary: "Walk through an app together at the owner's pace and leave written steps.", included: "A guided walkthrough and a written step-by-step card.", completion: "The owner completes the task once unaided and has the written steps.", minutes: 60, pay: 34, options: [opt.pace], popularity: 52 },
    { id: "tech-tablet", title: "Set up a tablet or e-reader", keywords: ["tablet", "ipad", "kindle", "setup"], summary: "Set up the tablet or e-reader with the owner entering their own credentials.", included: "Guided setup, accessibility settings, and a short walkthrough.", completion: "The device is set up and the owner can use it unaided.", minutes: 60, pay: 34, options: [opt.pace], popularity: 38 },
    { id: "tech-accessibility", title: "Turn on accessibility settings", keywords: ["accessibility", "text size", "voiceover", "contrast"], summary: "Set up larger text, contrast, or screen reading on the owner's devices.", included: "Configuring accessibility settings and explaining how to change them later.", completion: "The settings are applied and the owner can adjust them unaided.", minutes: 45, pay: 30, options: [opt.deviceCount], popularity: 36 },
    { id: "tech-cable-tidy", title: "Tidy cables behind a desk or TV", keywords: ["cables", "tidy", "desk", "wires"], summary: "Tidy and label the cables behind the desk or TV.", included: "Routing, tying, and labelling the existing cables.", excluded: "No rewiring, no work inside walls, and no new outlets.", completion: "The cables are tidy and labelled, and everything still works.", minutes: 45, pay: 28, popularity: 30 },
    { id: "tech-desk-setup", title: "Set up a desk or home office", keywords: ["desk", "office", "monitor", "setup"], summary: "Set up the desk, monitor, and peripherals so the workspace is ready to use.", included: "Assembly, connection, and a working test.", excluded: "No monitor wall mounting and no new electrical outlets.", completion: "The workspace is assembled and everything powers on.", minutes: 90, pay: 48, options: [opt.tools], popularity: 34 },
    { id: "tech-neighbor-clinic", title: "Volunteer at a tech help hour", keywords: ["volunteer", "clinic", "tech help", "hour"], summary: "Help neighbors with their devices during a scheduled tech help hour.", included: "Sitting with neighbors and helping with their own devices.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 90, pay: 0, modes: ["community"], popularity: 44 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Senior support                                                             */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "senior",
    label: "Senior support",
    icon: Heart,
    blurb: "Company and practical help, never care.",
    boundary: "Practical and social help only — no personal care, no lifting or transferring a person, no medication of any kind, and no financial or legal decisions.",
    baseExcluded: "No personal or medical care, medication handling, lifting or transferring a person, or financial and legal decisions.",
  },
  [
    { id: "sen-company", title: "Visit for company and conversation", keywords: ["company", "visit", "conversation", "loneliness"], summary: "Visit for conversation and company at the pace the person sets.", included: "Sitting and talking, and a cup of tea if offered.", completion: "The visit is finished and both people confirm in the thread.", minutes: 60, pay: 28, options: [opt.language, opt.mobility], popularity: 76 },
    { id: "sen-walk", title: "Go for a walk together", keywords: ["walk", "outdoors", "stroll", "exercise"], summary: "Go for a walk together at the pace the person sets.", included: "Walking alongside and steadying an arm only if offered.", excluded: "No lifting, transferring, or physically supporting a person's weight.", completion: "You are both back and confirm in the thread.", minutes: 45, pay: 24, options: [opt.mobility], popularity: 62 },
    { id: "sen-groceries", title: "Help put groceries away", keywords: ["groceries", "put away", "kitchen", "unpack"], summary: "Carry the delivered groceries in and put them away where they belong.", included: "Carrying in and putting away the shopping.", completion: "The groceries are put away and the bags are cleared.", minutes: 30, pay: 20, youth: true, popularity: 58 },
    { id: "sen-appointment-ride", title: "Accompany to a routine appointment", keywords: ["appointment", "accompany", "ride", "waiting room"], summary: "Accompany the person to a routine appointment and back.", included: "Travelling together and waiting in the waiting area.", excluded: "No entering the consultation, no medical decisions, and no handling of records.", completion: "You are both back and confirm in the thread.", minutes: 120, pay: 55, options: [opt.mobility, opt.vehicle, opt.distanceBand], popularity: 66 },
    { id: "sen-reading", title: "Read aloud or help with letters", keywords: ["reading", "letters", "aloud", "mail"], summary: "Read aloud, or read through everyday letters together.", included: "Reading aloud at the person's pace.", excluded: "No opening or handling of financial, legal, or medical documents.", completion: "The reading is finished and both people confirm in the thread.", minutes: 60, pay: 28, options: [opt.language], popularity: 40 },
    { id: "sen-tech-sit", title: "Patient tech help for a senior", keywords: ["tech", "patient", "senior", "phone"], summary: "Sit down and work through a device question slowly, leaving written steps.", included: "A guided walkthrough and a written step-by-step card.", excluded: "No passwords, banking, or account access at any point.", completion: "The person completes the step once unaided and has the written card.", minutes: 60, pay: 34, options: [opt.pace, opt.language], popularity: 68 },
    { id: "sen-light-housework", title: "Light housework alongside", keywords: ["housework", "light", "tidy", "help"], summary: "Work through light housework at the pace the person sets, with them directing.", included: "Tidying, wiping surfaces, and light kitchen work.", completion: "The agreed tasks are done and the person confirms in the thread.", minutes: 60, pay: 30, options: [opt.supplies], popularity: 54 },
    { id: "sen-plants", title: "Water plants and tidy the windowsill", keywords: ["plants", "watering", "windowsill", "indoor"], summary: "Water the indoor plants and tidy the windowsill.", included: "Watering and tidying the plant area.", completion: "The plants are watered and the sill is tidy.", minutes: 30, pay: 18, youth: true, popularity: 32 },
    { id: "sen-bins", title: "Bring bins out and back for a neighbor", keywords: ["bins", "trash", "neighbor", "collection"], summary: "Take the bins to the curb on collection day and bring them back.", included: "Moving the bins out and back.", completion: "The bins are back in place after collection.", minutes: 15, pay: 15, youth: true, popularity: 60 },
    { id: "sen-meal-share", title: "Cook or share a meal together", keywords: ["meal", "cook", "share", "dinner"], summary: "Cook a simple meal together from what is already in the kitchen.", included: "Preparing the meal together and clearing up after.", excluded: "No cooking for a medically restricted diet.", completion: "The meal is made and the kitchen is cleared.", minutes: 90, pay: 36, popularity: 34 },
    { id: "sen-phone-check", title: "Regular check-in visit", keywords: ["check in", "welfare", "regular", "visit"], summary: "Make the agreed check-in visit and leave a short note in the thread.", included: "The visit and a short written note afterwards.", excluded: "No welfare assessment and no contacting services on the person's behalf.", completion: "The visit is made and the note is in the thread.", minutes: 30, pay: 20, popularity: 44 },
    { id: "sen-seasonal", title: "Help with seasonal changeover", keywords: ["seasonal", "wardrobe", "swap", "storage"], summary: "Help swap out seasonal clothes or bedding and store what is going away.", included: "Swapping and boxing the seasonal items.", completion: "The swap is done and the stored items are boxed.", minutes: 60, pay: 28, popularity: 26 },
    { id: "sen-photos-print", title: "Print and sort family photos", keywords: ["photos", "print", "album", "family"], summary: "Sort the printed photos into an album together.", included: "Sorting and mounting the printed photos.", completion: "The album is filled and the leftovers are boxed.", minutes: 75, pay: 32, popularity: 22 },
    { id: "sen-neighbor-visit", title: "Volunteer a friendly visit", keywords: ["volunteer", "visit", "company", "neighbor"], summary: "Volunteer an hour of company with a neighbor who asked for a visit.", included: "Sitting and talking for the agreed hour.", completion: "The visit is finished and both people confirm in the thread.", minutes: 60, pay: 0, modes: ["community"], popularity: 56 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Events & setup                                                             */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "events",
    label: "Events & setup",
    icon: Confetti,
    blurb: "Setting up and packing down.",
    boundary: "No alcohol service, no crowd or door control, no cash handling, and no rigging, staging, or work at height.",
    baseExcluded: "No alcohol service, crowd or door control, cash handling, rigging, or work at height.",
  },
  [
    { id: "ev-setup", title: "Set up tables and chairs", keywords: ["tables", "chairs", "setup", "event"], summary: "Set out the tables and chairs to the layout agreed on site.", included: "Carrying and arranging the furniture to the layout.", completion: "The layout matches what was agreed.", minutes: 90, pay: 42, options: [opt.guestCount, opt.eventPhase], youth: true, popularity: 72 },
    { id: "ev-packdown", title: "Pack down after an event", keywords: ["pack down", "clear", "after", "event"], summary: "Pack down the event: stack furniture, bag rubbish, and return the space.", included: "Stacking, bagging, and returning the space to its normal layout.", completion: "The space is packed down and the rubbish is bagged.", minutes: 90, pay: 42, options: [opt.guestCount], youth: true, popularity: 68 },
    { id: "ev-decorate", title: "Put up decorations", keywords: ["decorations", "balloons", "banner", "party"], summary: "Put up the decorations at reachable height.", included: "Hanging reachable decorations and clearing the packaging.", excluded: "No ladders, rigging, or ceiling fixings.", completion: "The decorations are up and the packaging is cleared.", minutes: 60, pay: 30, youth: true, popularity: 50 },
    { id: "ev-food-setup", title: "Set out food and drinks", keywords: ["food", "buffet", "drinks", "serve"], summary: "Set out the food and non-alcoholic drinks on the serving tables.", included: "Setting out the food, plates, and non-alcoholic drinks.", excluded: "No alcohol service and no cooking for a medically restricted diet.", completion: "The tables are set and stocked.", minutes: 60, pay: 30, options: [opt.guestCount], youth: true, popularity: 46 },
    { id: "ev-greeter", title: "Help at a welcome table", keywords: ["welcome", "greeter", "sign in", "table"], summary: "Staff the welcome table and point people to the right place.", included: "Greeting arrivals and handing out the printed materials.", excluded: "No cash, ticketing, or door control.", completion: "The shift is finished and the organizer confirms in the thread.", minutes: 120, pay: 45, options: [opt.language], youth: true, popularity: 38 },
    { id: "ev-dishes", title: "Wash up during an event", keywords: ["dishes", "kitchen", "wash", "event"], summary: "Keep the kitchen moving during the event: wash up and clear the trays.", included: "Washing up and clearing the serving trays.", completion: "The kitchen is clear at the end of the shift.", minutes: 120, pay: 48, options: [opt.guestCount], youth: true, popularity: 34 },
    { id: "ev-photos", title: "Take photos at a community event", keywords: ["photos", "camera", "event", "document"], summary: "Take photos through the event and share the files afterwards.", included: "Photography during the event and sharing the files.", excluded: "No photographing children without the organizer's written consent list.", completion: "The photos are shared with the organizer.", minutes: 120, pay: 60, popularity: 30 },
    { id: "ev-signage", title: "Put out signage and route markers", keywords: ["signs", "signage", "markers", "route"], summary: "Place the printed signs and route markers along the agreed route.", included: "Placing and later collecting the signs.", excluded: "No signs on roadways, poles, or private property without permission.", completion: "The signs are placed, and collected again after.", minutes: 60, pay: 30, youth: true, popularity: 24 },
    { id: "ev-av", title: "Set up sound or a projector", keywords: ["sound", "speaker", "projector", "av"], summary: "Set up the sound system or projector and run a test.", included: "Setup, cabling at floor level, and a working test.", excluded: "No rigging, no work at height, and no electrical work beyond existing outlets.", completion: "Sound and picture work in a test run.", minutes: 60, pay: 40, popularity: 32 },
    { id: "ev-kids-activity", title: "Run a craft table at a family event", keywords: ["craft", "kids", "activity", "family"], summary: "Run the craft table with the parents and organizer present throughout.", included: "Setting out materials and helping at the table.", excluded: "No supervision of children — parents or organizers stay responsible throughout.", completion: "The activity is finished and the table is cleared.", minutes: 120, pay: 45, popularity: 26 },
    { id: "ev-runner", title: "Be a general helper for a shift", keywords: ["runner", "general", "shift", "helper"], summary: "Cover a general helper shift, taking direction from the organizer.", included: "Whatever the organizer directs within the agreed boundaries.", completion: "The shift is finished and the organizer confirms in the thread.", minutes: 120, pay: 45, options: [opt.shiftLength], youth: true, popularity: 42 },
    { id: "ev-volunteer-shift", title: "Volunteer a shift at a neighborhood event", keywords: ["volunteer", "event", "shift", "community"], summary: "Volunteer a shift at a neighborhood event.", included: "The volunteer shift as directed by the organizer.", completion: "The shift is finished and the organizer confirms in the thread.", minutes: 120, pay: 0, modes: ["community"], youth: true, popularity: 52 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Accessibility                                                              */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "access",
    label: "Accessibility",
    icon: Wheelchair,
    blurb: "Help that follows the person's lead.",
    boundary: "The person directs the task throughout — no personal care, no physical support of a person's weight, no handling of mobility equipment without direction, and no decisions made on their behalf.",
    baseExcluded: "No personal or medical care, no physically supporting a person's weight, and no decisions made on the person's behalf.",
  },
  [
    { id: "acc-shopping-partner", title: "Shop alongside someone", keywords: ["shopping", "alongside", "store", "assist"], summary: "Go to the store together and help reach, carry, and read labels as directed.", included: "Reaching, carrying, and reading labels at the person's direction.", excluded: "No paying, no card handling, and no choices made for the person.", completion: "The trip is finished and both people confirm in the thread.", minutes: 90, pay: 40, options: [opt.mobility, opt.distanceBand], popularity: 58 },
    { id: "acc-reader", title: "Read printed material aloud", keywords: ["read", "aloud", "print", "vision"], summary: "Read the printed material aloud at the pace the person sets.", included: "Reading aloud and re-reading on request.", excluded: "No summarising or interpreting unless the person asks for it.", completion: "The material is read and the person confirms in the thread.", minutes: 60, pay: 30, options: [opt.language], popularity: 44 },
    { id: "acc-describe", title: "Describe surroundings on an outing", keywords: ["describe", "sighted guide", "outing", "vision"], summary: "Act as a sighted guide on the agreed route, describing what is around.", included: "Guiding and describing at the person's direction.", excluded: "No route changes without the person agreeing first.", completion: "The outing is finished and both people confirm in the thread.", minutes: 90, pay: 40, options: [opt.mobility], popularity: 34 },
    { id: "acc-forms", title: "Help fill in a form the person dictates", keywords: ["form", "writing", "dictate", "paperwork"], summary: "Write out a form exactly as the person dictates it.", included: "Writing what is dictated and reading it back.", excluded: "No wording chosen by the helper, and no signing on the person's behalf.", completion: "The form is written, read back, and the person confirms it is correct.", minutes: 60, pay: 30, options: [opt.language], popularity: 30 },
    { id: "acc-reach", title: "Reach and fetch items around the home", keywords: ["reach", "fetch", "high shelf", "retrieve"], summary: "Move the items the person names to a height they can reach.", included: "Moving and reorganizing items to reachable heights.", completion: "The named items are within reach and the person confirms.", minutes: 45, pay: 26, popularity: 40 },
    { id: "acc-labels", title: "Make large-print or tactile labels", keywords: ["labels", "large print", "tactile", "organize"], summary: "Make and apply large-print or tactile labels with the materials provided.", included: "Making and applying the labels where the person asks.", completion: "The labels are applied and the person can identify each item.", minutes: 60, pay: 30, popularity: 24 },
    { id: "acc-equipment", title: "Assemble mobility or home equipment", keywords: ["equipment", "assemble", "rail", "aid"], summary: "Assemble the free-standing equipment from its instructions.", included: "Assembly of free-standing equipment and clearing the packaging.", excluded: "No fixing anything to walls, no grab rails, and no equipment a professional must fit.", completion: "The equipment is assembled, stable, and the person confirms it suits them.", minutes: 60, pay: 34, options: [opt.tools], popularity: 28 },
    { id: "acc-route-check", title: "Walk a route and note access barriers", keywords: ["route", "barriers", "access", "survey"], summary: "Walk the route and write down the access barriers found along it.", included: "Walking the route and producing the written notes.", completion: "The written notes are shared in the thread.", minutes: 60, pay: 30, youth: true, popularity: 20 },
    { id: "acc-tech-setup", title: "Set up assistive technology", keywords: ["assistive", "screen reader", "voice", "setup"], summary: "Set up assistive features on the person's own device with them directing.", included: "Configuring the assistive features and showing how to adjust them.", excluded: "No passwords or account access at any point.", completion: "The features work and the person can adjust them unaided.", minutes: 75, pay: 42, options: [opt.pace], popularity: 36 },
    { id: "acc-clear-path", title: "Clear a path or doorway", keywords: ["path", "doorway", "clear", "wheelchair"], summary: "Clear and widen the indoor paths so a wheelchair or walker can pass.", included: "Moving furniture and clutter out of the routes the person names.", completion: "The named routes are clear and the person confirms the width works.", minutes: 60, pay: 30, popularity: 32 },
    { id: "acc-transport-companion", title: "Ride along on public transport", keywords: ["transit", "bus", "companion", "ride"], summary: "Travel together on the agreed public transport route.", included: "Travelling alongside and helping as directed.", excluded: "No physical transfers and no route changes without agreement.", completion: "The journey is finished and both people confirm in the thread.", minutes: 90, pay: 38, options: [opt.mobility, opt.language], popularity: 26 },
    { id: "acc-volunteer-hour", title: "Volunteer an access support hour", keywords: ["volunteer", "access", "support", "hour"], summary: "Volunteer an hour of access support, following the person's direction throughout.", included: "The agreed hour of support at the person's direction.", completion: "The hour is finished and both people confirm in the thread.", minutes: 60, pay: 0, modes: ["community"], popularity: 42 },
  ],
);

/* -------------------------------------------------------------------------- */
/* School & learning                                                          */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "learning",
    label: "School & learning",
    icon: GraduationCap,
    blurb: "Tutoring in supervised settings only.",
    boundary: "Sessions with anyone under 18 happen in a public or supervised setting with a guardian present or on site — this is tutoring, never childcare or supervision.",
    baseExcluded: "No childcare or supervision responsibility, no unsupervised time with a minor, no transport of a minor, and no sitting exams or completing graded work for the student.",
  },
  [
    { id: "learn-homework", title: "Homework help session", keywords: ["homework", "tutor", "study", "school"], summary: "Work through the homework together in the agreed supervised setting.", included: "Explaining the material and checking the student's own work.", completion: "The session ends and the student can explain the method back.", minutes: 60, pay: 32, options: [opt.gradeBand, opt.sessionLength], popularity: 74 },
    { id: "learn-math", title: "Math tutoring", keywords: ["math", "algebra", "tutor", "numbers"], summary: "Work through the math topic together in the agreed supervised setting.", included: "Explaining the topic and practising problems together.", completion: "The student solves a practice problem unaided.", minutes: 60, pay: 36, options: [opt.gradeBand, opt.sessionLength], popularity: 70 },
    { id: "learn-reading", title: "Reading practice", keywords: ["reading", "literacy", "practice", "phonics"], summary: "Read together and practise at the level the guardian sets.", included: "Reading aloud together and gentle correction.", completion: "The session ends and you leave a short progress note.", minutes: 45, pay: 28, options: [opt.gradeBand, opt.language], popularity: 56 },
    { id: "learn-writing", title: "Writing and essay feedback", keywords: ["writing", "essay", "feedback", "english"], summary: "Give feedback on the student's own draft in the agreed supervised setting.", included: "Reading the draft and talking through the feedback.", excluded: "No writing or rewriting the work for the student.", completion: "The feedback is discussed and the student notes their next revision.", minutes: 60, pay: 36, options: [opt.gradeBand], popularity: 44 },
    { id: "learn-language", title: "Language conversation practice", keywords: ["language", "conversation", "practice", "speaking"], summary: "Practise conversation in the agreed language for the session.", included: "Conversation practice and gentle correction.", completion: "The session ends and both people confirm in the thread.", minutes: 60, pay: 32, options: [opt.language, opt.sessionLength], popularity: 48 },
    { id: "learn-esl", title: "English practice for an adult learner", keywords: ["english", "esl", "adult", "practice"], summary: "Practise English conversation with an adult learner at their pace.", included: "Conversation practice and vocabulary work.", completion: "The session ends and both people confirm in the thread.", minutes: 60, pay: 32, options: [opt.language, opt.sessionLength], popularity: 40 },
    { id: "learn-test-prep", title: "Test preparation session", keywords: ["test prep", "sat", "exam", "study"], summary: "Work through test preparation material in the agreed supervised setting.", included: "Working through practice questions and technique.", excluded: "No sitting or assisting during an actual exam.", completion: "The practice set is reviewed and the student notes what to revise.", minutes: 90, pay: 50, options: [opt.gradeBand], popularity: 42 },
    { id: "learn-science", title: "Science tutoring", keywords: ["science", "biology", "chemistry", "physics"], summary: "Work through the science topic together in the agreed supervised setting.", included: "Explaining the topic and working through problems.", excluded: "No practical experiments, chemicals, or heat sources.", completion: "The student explains the concept back in their own words.", minutes: 60, pay: 38, options: [opt.gradeBand, opt.sessionLength], popularity: 38 },
    { id: "learn-music", title: "Music practice session", keywords: ["music", "instrument", "practice", "lesson"], summary: "Practise the instrument together in the agreed supervised setting.", included: "Guided practice on the student's own instrument.", completion: "The session ends and you leave a short practice note.", minutes: 45, pay: 34, options: [opt.gradeBand, opt.sessionLength], popularity: 34 },
    { id: "learn-computer-skills", title: "Basic computer skills lesson", keywords: ["computer", "skills", "typing", "basics"], summary: "Teach the computer skill asked for, at the learner's pace.", included: "A guided lesson and a written summary of the steps.", excluded: "No passwords or account access at any point.", completion: "The learner completes the task once unaided.", minutes: 60, pay: 34, options: [opt.pace], popularity: 36 },
    { id: "learn-college-apps", title: "Talk through college or job applications", keywords: ["college", "application", "resume", "job"], summary: "Talk through the application or resume with the applicant driving.", included: "Reviewing the applicant's own draft and discussing it.", excluded: "No writing the application and no submitting anything on their behalf.", completion: "The review is finished and the applicant notes their next step.", minutes: 60, pay: 36, popularity: 30 },
    { id: "learn-study-skills", title: "Study skills and organization", keywords: ["study skills", "organize", "planner", "notes"], summary: "Set up a study plan and note-taking system together.", included: "Building the plan and setting up the notes.", completion: "The plan is written down and the student has a copy.", minutes: 60, pay: 32, options: [opt.gradeBand], popularity: 26 },
    { id: "learn-library-session", title: "Study session at the library", keywords: ["library", "study", "session", "public"], summary: "Meet at the library for a supervised study session in the public study area.", included: "Study support in the public area of the library.", completion: "The session ends and the guardian confirms in the thread.", minutes: 90, pay: 40, options: [opt.gradeBand], popularity: 32 },
    { id: "learn-volunteer-tutor", title: "Volunteer tutoring hour", keywords: ["volunteer", "tutor", "hour", "free"], summary: "Volunteer a tutoring hour in the agreed supervised setting.", included: "The tutoring hour with a guardian or coordinator present.", completion: "The hour is finished and the guardian or coordinator confirms in the thread.", minutes: 60, pay: 0, modes: ["community"], popularity: 46 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Community & mutual aid                                                     */
/* -------------------------------------------------------------------------- */

category(
  {
    id: "mutual",
    label: "Community & mutual aid",
    icon: HandHeart,
    blurb: "Neighbors showing up for each other.",
    boundary: "Volunteer neighbor help only — no professional services, no cash collection, no political or religious canvassing, and no work that a licensed trade should do.",
    baseExcluded: "No professional or licensed work, cash collection, canvassing, or anything a licensed trade should carry out.",
  },
  [
    { id: "mut-food-pantry", title: "Sort and pack at a food pantry", keywords: ["food", "pantry", "pack", "volunteer"], summary: "Sort and pack food boxes during a scheduled pantry shift.", included: "Sorting, packing, and stacking during the shift.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community", "sponsored"], youth: true, popularity: 82 },
    { id: "mut-meal-delivery", title: "Deliver meals to neighbors", keywords: ["meals", "delivery", "route", "volunteer"], summary: "Deliver the prepared meals along the assigned route.", included: "Collecting the meals and delivering them along the route.", excluded: "No entering homes and no handling of medical or dietary decisions.", completion: "The route is complete and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community", "sponsored"], options: [opt.vehicle], popularity: 70 },
    { id: "mut-cleanup", title: "Join a neighborhood cleanup", keywords: ["cleanup", "litter", "street", "volunteer"], summary: "Join the scheduled cleanup and clear litter along the assigned stretch.", included: "Litter picking and bagging during the shift.", excluded: "No needles, glass hazards, or anything needing protective handling.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community", "sponsored"], youth: true, popularity: 76 },
    { id: "mut-supply-drive", title: "Sort donations at a supply drive", keywords: ["donations", "drive", "sort", "volunteer"], summary: "Sort and box the donated goods during the drive.", included: "Sorting, boxing, and labelling the donations.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community", "sponsored"], youth: true, popularity: 58 },
    { id: "mut-welcome-kit", title: "Assemble welcome or care kits", keywords: ["care kits", "assemble", "welcome", "pack"], summary: "Assemble the care kits from the supplies laid out.", included: "Packing and labelling the kits.", completion: "The kits are packed and counted with the coordinator.", minutes: 90, pay: 0, modes: ["community", "sponsored"], youth: true, popularity: 44 },
    { id: "mut-garden-plot", title: "Work a community garden shift", keywords: ["community garden", "plot", "shift", "volunteer"], summary: "Work a shift in the community garden at ground level.", included: "Ground-level garden work as the coordinator directs.", excluded: "No ladders, power tools, or chemical spraying.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community"], options: [opt.shiftLength], youth: true, popularity: 62 },
    { id: "mut-tool-library", title: "Help at a tool or seed library", keywords: ["tool library", "seed", "lending", "volunteer"], summary: "Help run the tool or seed library during opening hours.", included: "Checking items in and out and tidying the shelves.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community"], youth: true, popularity: 34 },
    { id: "mut-repair-cafe", title: "Fix things at a repair cafe", keywords: ["repair", "cafe", "fix", "mend"], summary: "Help neighbors repair small items during a repair cafe session.", included: "Small hand repairs at the workbench.", excluded: "No mains electrical repair and no gas appliances.", completion: "The session is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community"], popularity: 40 },
    { id: "mut-translate", title: "Interpret at a community session", keywords: ["translate", "interpret", "language", "volunteer"], summary: "Interpret between neighbors and staff during the session.", included: "Interpreting what is said, without adding or advising.", excluded: "No legal, medical, or immigration advice of any kind.", completion: "The session is finished and the coordinator confirms in the thread.", minutes: 90, pay: 0, modes: ["community", "sponsored"], options: [opt.language], popularity: 46 },
    { id: "mut-phone-tree", title: "Make neighborhood check-in calls", keywords: ["calls", "check in", "phone tree", "welfare"], summary: "Make the check-in calls on the coordinator's list and log the replies.", included: "The calls and the written log.", excluded: "No welfare assessment and no contacting emergency services on someone's behalf unless the coordinator's script says to.", completion: "The list is called through and the log is shared.", minutes: 90, pay: 0, modes: ["community"], popularity: 30 },
    { id: "mut-emergency-prep", title: "Help assemble emergency kits", keywords: ["emergency", "prep", "kits", "disaster"], summary: "Assemble neighborhood emergency kits from the supplies laid out.", included: "Packing, labelling, and stacking the kits.", completion: "The kits are packed and counted with the coordinator.", minutes: 120, pay: 0, modes: ["community", "sponsored"], youth: true, popularity: 36 },
    { id: "mut-mural", title: "Help on a community art project", keywords: ["mural", "art", "paint", "project"], summary: "Help on the community art project at ground level.", included: "Ground-level painting or making as the lead artist directs.", excluded: "No scaffolding, ladders, or work at height.", completion: "The session is finished and the lead confirms in the thread.", minutes: 120, pay: 0, modes: ["community", "sponsored"], youth: true, popularity: 32 },
    { id: "mut-shelter-supplies", title: "Sort supplies at a shelter", keywords: ["shelter", "supplies", "sort", "volunteer"], summary: "Sort and stock supplies during a shelter shift.", included: "Sorting and stocking as the coordinator directs.", excluded: "No case work, no personal care, and no handling of anyone's belongings without staff present.", completion: "The shift is finished and the coordinator confirms in the thread.", minutes: 120, pay: 0, modes: ["community", "sponsored"], popularity: 42 },
    { id: "mut-open-hour", title: "Offer an hour to whoever needs it", keywords: ["volunteer", "open", "hour", "anything"], summary: "Offer an hour of general neighbor help, scoped in the thread before it starts.", included: "One hour of help within Micro's safety boundaries, agreed in the thread first.", completion: "The hour is finished and both people confirm in the thread.", minutes: 60, pay: 0, modes: ["community"], popularity: 54 },
  ],
);

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export const catalogCategories = categories;
export const taskTemplates = templates;

export type ComposedListing = {
  title: string;
  details: string;
  included: string;
  excluded: string;
  completion: string;
  duration: string;
  minutes: number;
  suggestedPay: number;
};

export function templateById(id: string): TaskTemplate | undefined {
  return templates.find((template) => template.id === id);
}

export function categoryById(id: string): CatalogCategory | undefined {
  return categories.find((entry) => entry.id === id);
}

/** The choice a control starts on, keyed by option id. */
export function defaultSelections(template: TaskTemplate): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const control of template.options) selections[control.id] = control.choices[control.defaultIndex].id;
  return selections;
}

function selectedChoices(template: TaskTemplate, selections: Record<string, string>): CatalogChoice[] {
  return template.options.map((control) => control.choices.find((choice) => choice.id === selections[control.id]) ?? control.choices[control.defaultIndex]);
}

/**
 * Turns an authored template plus the requester's bounded answers into the
 * public listing copy. This is the only path to a published listing, so no
 * free-typed text can reach a neighbor.
 */
export function composeListing(template: TaskTemplate, selections: Record<string, string>): ComposedListing {
  const choices = selectedChoices(template, selections);
  const sentences = (base: string, pick: (choice: CatalogChoice) => string | undefined) => [base, ...choices.map(pick).filter(Boolean)].join(" ");
  const minutes = Math.min(240, Math.max(15, choices.reduce((total, choice) => total + (choice.minutes ?? 0), template.minutes)));
  const suggestedPay = Math.max(15, choices.reduce((total, choice) => total + (choice.pay ?? 0), template.pay));
  return {
    title: template.title,
    details: sentences(template.summary, (choice) => choice.phrase),
    included: sentences(template.included, (choice) => choice.includes),
    excluded: sentences(template.excluded, (choice) => choice.excludes),
    completion: template.completion,
    duration: `${minutes} min`,
    minutes,
    suggestedPay,
  };
}

/**
 * Client-side lookup over the loaded catalog: title, category, and the
 * authored keywords. No network call and no free-text passthrough — a query
 * that matches nothing simply returns nothing.
 */
export function searchTemplates(pool: TaskTemplate[], query: string): TaskTemplate[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return pool;
  return pool.filter((template) => {
    const haystack = `${template.title} ${template.category} ${template.keywords.join(" ")}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
