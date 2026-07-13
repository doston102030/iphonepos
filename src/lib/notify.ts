import { toast } from 'sonner';
import { playSuccess, playError } from './sound';

// Toast + sound in one call, so a finished action both shows and is heard. Use
// these for the end of a real action (a sale, a saved record); plain `toast` is
// still fine for passing hints that do not deserve a sound.
export const notify = {
  success(message: string) {
    playSuccess();
    return toast.success(message);
  },
  error(message: string) {
    playError();
    return toast.error(message);
  },
};
