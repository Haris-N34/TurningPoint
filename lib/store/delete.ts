import { media } from "./media";
import { store } from "./store";

/** C7.5: remove all of the candidate's data from this device, recordings included. */
export async function deleteMyData() {
  store().deleteAll();
  try {
    await media.clear();
  } catch {
    // No IndexedDB (private window): nothing stored there.
  }
}
