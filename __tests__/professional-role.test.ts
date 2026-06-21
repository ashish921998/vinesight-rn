import { deriveProfessionalRole } from '@/utils/professional-role';
import type { ProfessionalWorkspace } from '@/services/delegated-logs';

function workspace(role: 'owner' | 'admin' | 'agronomist'): ProfessionalWorkspace {
  return {
    organization_id: 'org-1',
    organization_name: 'Vine Org',
    role,
    clients: [],
  };
}

describe('deriveProfessionalRole', () => {
  it('flags owner as manager + owner, not agronomist', () => {
    const flags = deriveProfessionalRole(workspace('owner'));
    expect(flags).toMatchObject({
      role: 'owner',
      isOwner: true,
      isManager: true,
      isAgronomist: false,
      canManageOrg: true,
    });
  });

  it('flags admin as manager but not owner', () => {
    const flags = deriveProfessionalRole(workspace('admin'));
    expect(flags).toMatchObject({
      role: 'admin',
      isOwner: false,
      isManager: true,
      isAgronomist: false,
      canManageOrg: true,
    });
  });

  it('flags agronomist as neither owner nor manager', () => {
    const flags = deriveProfessionalRole(workspace('agronomist'));
    expect(flags).toMatchObject({
      role: 'agronomist',
      isOwner: false,
      isManager: false,
      isAgronomist: true,
      canManageOrg: false,
    });
  });

  it('treats a farmer (null workspace) as no role', () => {
    const flags = deriveProfessionalRole(null);
    expect(flags).toMatchObject({
      role: null,
      isOwner: false,
      isManager: false,
      isAgronomist: false,
      canManageOrg: false,
    });
  });

  it('treats an unset workspace the same as null', () => {
    expect(deriveProfessionalRole(undefined)).toEqual(deriveProfessionalRole(null));
  });
});
