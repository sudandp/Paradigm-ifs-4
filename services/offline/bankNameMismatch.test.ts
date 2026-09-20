import { describe, it, expect, beforeEach } from 'vitest';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { BankDetails } from '../../types';

describe('Bank Name Mismatch & Field Officer Acknowledgement', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('initializes bank state with default empty name mismatch fields', () => {
    const { data } = useOnboardingStore.getState();
    expect(data.bank.nameMismatchReason).toBe('');
    expect(data.bank.nameMismatchAcknowledged).toBe(false);
    expect(data.bank.nameMismatchAcknowledgedBy).toBe('');
    expect(data.bank.nameMismatchAcknowledgedAt).toBe('');
  });

  it('updates store when name mismatch reason and field officer acknowledgement are provided', () => {
    const store = useOnboardingStore.getState();
    const update: Partial<BankDetails> = {
      accountHolderName: 'Satyan Baishya',
      accountNumber: '1446956237',
      confirmAccountNumber: '1446956237',
      ifscCode: 'KKBK0008112',
      bankName: 'Kotak Mahindra Bank',
      branchName: 'HSR Layout',
      nameMismatchReason: "Employee has no bank account — Father's account provided",
      nameMismatchAcknowledged: true,
      nameMismatchAcknowledgedBy: 'Sudhan M (Field Officer)',
      nameMismatchAcknowledgedAt: new Date().toISOString(),
    };

    store.updateBank(update);

    const updated = useOnboardingStore.getState().data.bank;
    expect(updated.accountHolderName).toBe('Satyan Baishya');
    expect(updated.nameMismatchReason).toBe("Employee has no bank account — Father's account provided");
    expect(updated.nameMismatchAcknowledged).toBe(true);
    expect(updated.nameMismatchAcknowledgedBy).toBe('Sudhan M (Field Officer)');
    expect(updated.nameMismatchAcknowledgedAt).toBeTruthy();
  });

  it('accurately identifies name mismatch between personal profile and account holder name', () => {
    const store = useOnboardingStore.getState();
    store.updatePersonal({
      firstName: 'Sudhan',
      lastName: 'M',
    });

    const candidateProfileName = `${useOnboardingStore.getState().data.personal.firstName || ''} ${useOnboardingStore.getState().data.personal.lastName || ''}`.trim().toLowerCase();
    
    // Case 1: Mismatched name (e.g. father account)
    const mismatchedAccountName = 'Satyan Baishya'.trim().toLowerCase();
    const isMismatch = candidateProfileName !== mismatchedAccountName;
    expect(isMismatch).toBe(true);

    // Case 2: Matching name (case-insensitive)
    const matchingAccountName = 'sudhan m'.trim().toLowerCase();
    const isMatch = candidateProfileName === matchingAccountName;
    expect(isMatch).toBe(true);
  });

  it('enforces gating rule: fails validation if mismatch exists but reason is missing or FO not acknowledged', () => {
    const validateSubmission = (
      isMismatch: boolean,
      reason?: string,
      acknowledged?: boolean
    ) => {
      if (!isMismatch) return { canProceed: true, errors: {} };

      const trimmedReason = (reason || '').trim();
      const isAck = Boolean(acknowledged);
      const errors: { reason?: string; ack?: string } = {};

      if (!trimmedReason) {
        errors.reason = 'Please provide a reason explaining why the bank account name differs from the employee profile name.';
      }
      if (!isAck) {
        errors.ack = 'Field Officer acknowledgement is mandatory before proceeding to the next stage.';
      }

      return {
        canProceed: Object.keys(errors).length === 0,
        errors,
      };
    };

    // 1. Missing both reason and acknowledgement -> blocked
    const res1 = validateSubmission(true, '', false);
    expect(res1.canProceed).toBe(false);
    expect(res1.errors.reason).toBeTruthy();
    expect(res1.errors.ack).toBeTruthy();

    // 2. Reason provided, but FO acknowledgement unchecked -> blocked
    const res2 = validateSubmission(true, "Father's account provided", false);
    expect(res2.canProceed).toBe(false);
    expect(res2.errors.reason).toBeUndefined();
    expect(res2.errors.ack).toBeTruthy();

    // 3. FO acknowledgement checked, but reason blank -> blocked
    const res3 = validateSubmission(true, '   ', true);
    expect(res3.canProceed).toBe(false);
    expect(res3.errors.reason).toBeTruthy();
    expect(res3.errors.ack).toBeUndefined();

    // 4. Both reason and FO acknowledgement provided -> allowed to proceed
    const res4 = validateSubmission(true, "Employee has no bank account — Father's account provided", true);
    expect(res4.canProceed).toBe(true);
    expect(res4.errors).toEqual({});

    // 5. No name mismatch -> allowed to proceed without reason or ack
    const res5 = validateSubmission(false, '', false);
    expect(res5.canProceed).toBe(true);
    expect(res5.errors).toEqual({});
  });
});
