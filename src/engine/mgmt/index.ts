// VCF 9.x Management Domain — public barrel
// P1 surface: types + sizing tables + profiles only.
// P2 will append calcManagement() and the calc pipeline.

export type {
  MgmtProfile,
  ApplianceSize,
  NsxEdgeSize,
  SspSize,
  SrmSize,
  CollectorSize,
  AnyApplianceSize,
  MgmtApplianceCategory,
  AutoApplianceCategory,
  ApplianceLineCategory,
  ApplianceSpec,
  ProfileEntry,
  ApplianceOverride,
  ValidatedSolutionsConfig,
  ManagementDomainConfig,
  ApplianceLine,
  MgmtDomainResult,
} from './types'

export {
  getApplianceSpec,
  SDDC_MANAGER_SPEC,
  FLEET_MANAGER_SPEC,
  VALIDATED_SOLUTIONS_SPECS,
} from './constants'

export {
  PROFILES,
  resolveProfileEntry,
} from './profiles'
