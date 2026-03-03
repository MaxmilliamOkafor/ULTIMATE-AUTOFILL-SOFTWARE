import type { ATSAdapter, ATSType } from '../types/index';
import { workdayAdapter } from './workday/index';
import { greenhouseAdapter } from './greenhouse/index';
import { genericAdapter } from './generic/index';
import { leverAdapter } from './lever/index';
import { icimsAdapter } from './icims/index';
import { smartRecruitersAdapter } from './smartrecruiters/index';
import { taleoAdapter } from './taleo/index';

const adapters: Record<string, ATSAdapter> = {
  workday: workdayAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  icims: icimsAdapter,
  smartrecruiters: smartRecruitersAdapter,
  taleo: taleoAdapter,
  generic: genericAdapter,
};

export function getAdapter(type: ATSType): ATSAdapter {
  return adapters[type] || genericAdapter;
}

export function getAllAdapters(): ATSAdapter[] {
  return Object.values(adapters);
}

export {
  workdayAdapter, greenhouseAdapter, genericAdapter,
  leverAdapter, icimsAdapter, smartRecruitersAdapter, taleoAdapter,
};
