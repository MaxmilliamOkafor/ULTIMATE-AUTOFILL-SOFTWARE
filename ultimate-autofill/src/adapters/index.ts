import type { ATSAdapter, ATSType } from '../types/index';
import { workdayAdapter } from './workday/index';
import { greenhouseAdapter } from './greenhouse/index';
import { genericAdapter } from './generic/index';

const adapters: Record<string, ATSAdapter> = {
  workday: workdayAdapter,
  greenhouse: greenhouseAdapter,
  generic: genericAdapter,
};

export function getAdapter(type: ATSType): ATSAdapter {
  return adapters[type] || genericAdapter;
}

export { workdayAdapter, greenhouseAdapter, genericAdapter };
