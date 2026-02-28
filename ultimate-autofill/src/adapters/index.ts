import type { ATSAdapter, ATSType } from '../types/index';
import { workdayAdapter } from './workday/index';
import { greenhouseAdapter } from './greenhouse/index';
import { leverAdapter } from './lever/index';
import { smartrecruitersAdapter } from './smartrecruiters/index';
import { oraclecloudAdapter } from './oraclecloud/index';
import { indeedAdapter } from './indeed/index';
import { linkedinAdapter } from './linkedin/index';
import { genericAdapter } from './generic/index';

const adapters: Record<string, ATSAdapter> = {
  workday: workdayAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  smartrecruiters: smartrecruitersAdapter,
  oraclecloud: oraclecloudAdapter,
  indeed: indeedAdapter,
  linkedin: linkedinAdapter,
  companysite: genericAdapter,   // company sites use the universal generic adapter
  generic: genericAdapter,
};

export function getAdapter(type: ATSType): ATSAdapter {
  return adapters[type] || genericAdapter;
}

export {
  workdayAdapter,
  greenhouseAdapter,
  leverAdapter,
  smartrecruitersAdapter,
  oraclecloudAdapter,
  indeedAdapter,
  linkedinAdapter,
  genericAdapter,
};
