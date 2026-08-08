import { Wrench } from "@phosphor-icons/react";
import { categoryById } from "../taskCatalog";
import { initialsFromName } from "./AuthProvider";
import type { AreaId } from "./geo";
import type { Task, TaskMode } from "./types";

/** Convert the public task row/view shape into the single UI task model. */
export function taskFromRow(row: Record<string, unknown>): Task {
  const categoryId = String(row.category_id ?? "");
  const category = categoryById(categoryId);
  const earning = row.earning === null || row.earning === undefined ? undefined : Number(row.earning);
  const requesterName = (row.requester_name as string) || "A neighbor";
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    title: String(row.title),
    description: String(row.description),
    mode: String(row.mode) as TaskMode,
    earning,
    coords: { lat: Number(row.lat), lng: Number(row.lng) },
    areaId: String(row.area_id) as AreaId,
    area: String(row.area),
    time: String(row.time_label),
    startsAt: row.starts_at ? new Date(String(row.starts_at)) : undefined,
    duration: String(row.duration),
    icon: category?.icon ?? Wrench,
    category: String(row.category),
    included: String(row.included ?? ""),
    excluded: String(row.excluded ?? ""),
    completion: String(row.completion ?? ""),
    requesterName,
    requesterInitials: initialsFromName(requesterName),
    youthEligible: Boolean(row.youth_eligible),
    listingPaused: Boolean(row.listing_paused),
    customPending: Boolean(row.custom_pending) || undefined,
  };
}
