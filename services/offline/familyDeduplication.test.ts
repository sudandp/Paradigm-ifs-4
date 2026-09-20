import { describe, it, expect } from 'vitest';
import { deduplicateFamilyMembers } from '../../store/onboardingStore';
import type { FamilyMember } from '../../types';

describe('deduplicateFamilyMembers', () => {
  it('deduplicates members with the same ID and ensures unique keys', () => {
    const duplicateId = 'fam_father_1789898645564';
    const family: FamilyMember[] = [
      {
        id: duplicateId,
        name: 'Satyanarayana',
        relation: '',
        dob: '',
        gender: 'Male',
        occupation: '',
        dependent: false,
        idProof: null,
        phone: '',
      },
      {
        id: duplicateId,
        name: 'Satyanarayana',
        relation: 'Father',
        dob: '1970-01-01',
        gender: 'Male',
        occupation: 'Farmer',
        dependent: true,
        idProof: null,
        phone: '9876543210',
      },
    ];

    const result = deduplicateFamilyMembers(family);

    // Because both are Father / same member, they should be merged into 1 item
    expect(result.length).toBe(1);
    expect(result[0].relation).toBe('Father');
    expect(result[0].phone).toBe('9876543210');
    expect(result[0].id).toBe(duplicateId);
  });

  it('guarantees unique IDs if two different members share an ID', () => {
    const duplicateId = 'duplicate_id_123';
    const family: FamilyMember[] = [
      {
        id: duplicateId,
        name: 'Child One',
        relation: 'Child',
        dob: '2010-05-10',
        gender: 'Female',
        occupation: '',
        dependent: true,
        idProof: null,
        phone: '',
      },
      {
        id: duplicateId,
        name: 'Child Two',
        relation: 'Child',
        dob: '2012-08-15',
        gender: 'Male',
        occupation: '',
        dependent: true,
        idProof: null,
        phone: '',
      },
    ];

    const result = deduplicateFamilyMembers(family);

    expect(result.length).toBe(2);
    expect(result[0].id).not.toBe(result[1].id);
    expect(result[0].name).toBe('Child One');
    expect(result[1].name).toBe('Child Two');
  });

  it('handles null, undefined, or empty family array safely', () => {
    expect(deduplicateFamilyMembers([] as any)).toEqual([]);
    expect(deduplicateFamilyMembers(null as any)).toEqual([]);
    expect(deduplicateFamilyMembers(undefined as any)).toEqual([]);
  });
});
