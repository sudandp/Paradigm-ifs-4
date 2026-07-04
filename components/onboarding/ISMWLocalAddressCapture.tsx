/**
 * ISMWLocalAddressCapture.tsx
 * Sub-step component for Inter-State Migrant Workers (ISMW Act 1979 compliance).
 *
 * Shown only when ISMWFlags.isMigrant === true (detected in AddressDetails on pincode blur).
 *
 * Collects:
 * 1. Local (deployment city) residential address with rent receipt / hostel letter upload
 * 2. Geo-tagged selfie at the local address
 * 3. Optional: local emergency contact (required for states flagged requiresBonafideCertificate)
 *
 * All captured data is stored in onboardingStore under data.ismwLocalAddress
 * and will be included in the enterprise handshake bus payload (Phase 3).
 */

import React, { useState, useCallback } from 'react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { captureGeoTaggedSelfie, type GeoTaggedSelfie } from '../../services/antiFraudEngine';
import { ShieldAlert, Camera, Upload, CheckCircle2, Loader2, MapPin, Phone, User, FileText, XCircle } from 'lucide-react';
import Input from '../ui/Input';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ISMWLocalAddress {
  line1: string;
  city: string;
  state: string;        // should match deployment state
  pincode: string;
  landlordName?: string;
  landlordPhone?: string;
  localEmergencyContact?: string;
  localEmergencyPhone?: string;
  rentReceiptDataUrl?: string;   // base64 uploaded document
  rentReceiptFileName?: string;
  geoTaggedSelfie?: GeoTaggedSelfie;
  capturedAt: string;
}

interface ISMWLocalAddressCaptureProps {
  deploymentState: string;         // Present state (from AddressDetails present.state)
  requiresEmergencyContact: boolean;
  onComplete: (data: ISMWLocalAddress) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ISMWLocalAddressCapture: React.FC<ISMWLocalAddressCaptureProps> = ({
  deploymentState,
  requiresEmergencyContact,
  onComplete,
}) => {
  const [form, setForm] = useState<Partial<ISMWLocalAddress>>({});
  const [selfie, setSelfie] = useState<GeoTaggedSelfie | null>(null);
  const [isTakingSelfie, setIsTakingSelfie] = useState(false);
  const [selfieError, setSelfieError] = useState('');
  const [rentReceiptName, setRentReceiptName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof ISMWLocalAddress, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Rent receipt file upload (stored as base64)
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRentReceiptName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(prev => ({
        ...prev,
        rentReceiptDataUrl: ev.target?.result as string,
        rentReceiptFileName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  // Geo-tagged selfie at local address
  const handleSelfie = useCallback(async () => {
    setIsTakingSelfie(true);
    setSelfieError('');
    const result = await captureGeoTaggedSelfie();
    setIsTakingSelfie(false);
    if (result) {
      setSelfie(result);
      setForm(prev => ({ ...prev, geoTaggedSelfie: result }));
    } else {
      setSelfieError('Selfie capture failed. Please allow camera access and try again.');
    }
  }, []);

  // Validation & submit
  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!form.line1?.trim()) newErrors.line1 = 'Local address line 1 is required';
    if (!form.city?.trim()) newErrors.city = 'City is required';
    if (!form.pincode?.trim() || !/^[1-9][0-9]{5}$/.test(form.pincode)) newErrors.pincode = 'Valid 6-digit pincode required';
    if (!form.rentReceiptDataUrl) newErrors.rentReceipt = 'Rent receipt or hostel letter is required';
    if (!selfie) newErrors.selfie = 'Geo-tagged selfie at local address is required';
    if (requiresEmergencyContact) {
      if (!form.localEmergencyContact?.trim()) newErrors.localEmergencyContact = 'Local emergency contact name is required';
      if (!form.localEmergencyPhone?.trim()) newErrors.localEmergencyPhone = 'Emergency contact phone is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onComplete({ ...form, geoTaggedSelfie: selfie!, capturedAt: new Date().toISOString() } as ISMWLocalAddress);
  };

  return (
    <div id="ismw-local-address-capture" className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-5 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-300 text-sm">ISMW Compliance — Local Address Required</p>
          <p className="text-xs text-muted mt-0.5">
            This worker is an inter-state migrant (ISMW Act 1979). Their local residential
            address in <span className="font-semibold text-primary-text">{deploymentState}</span> must
            be captured with proof of residence and a geo-tagged selfie.
          </p>
        </div>
      </div>

      {/* Address fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="ismw-line1" className="block text-xs font-medium text-muted mb-1">
            Local Address Line 1 *
          </label>
          <input
            id="ismw-line1"
            type="text"
            value={form.line1 ?? ''}
            onChange={e => set('line1', e.target.value)}
            placeholder="Flat / Room no., Building, Street"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {errors.line1 && <p className="text-xs text-red-500 mt-1">{errors.line1}</p>}
        </div>

        <div>
          <label htmlFor="ismw-city" className="block text-xs font-medium text-muted mb-1">City *</label>
          <input
            id="ismw-city"
            type="text"
            value={form.city ?? ''}
            onChange={e => set('city', e.target.value)}
            placeholder="e.g. Bengaluru"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
        </div>

        <div>
          <label htmlFor="ismw-pincode" className="block text-xs font-medium text-muted mb-1">Pincode *</label>
          <input
            id="ismw-pincode"
            type="tel"
            maxLength={6}
            value={form.pincode ?? ''}
            onChange={e => set('pincode', e.target.value)}
            placeholder="560001"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
        </div>

        <div>
          <label htmlFor="ismw-landlord" className="block text-xs font-medium text-muted mb-1">Landlord / Hostel Name</label>
          <input
            id="ismw-landlord"
            type="text"
            value={form.landlordName ?? ''}
            onChange={e => set('landlordName', e.target.value)}
            placeholder="Optional"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="ismw-landlord-phone" className="block text-xs font-medium text-muted mb-1">Landlord Phone</label>
          <input
            id="ismw-landlord-phone"
            type="tel"
            value={form.landlordPhone ?? ''}
            onChange={e => set('landlordPhone', e.target.value)}
            placeholder="Optional"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Emergency contact (required for states needing bonafide cert) */}
      {requiresEmergencyContact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <p className="sm:col-span-2 text-xs text-amber-400 font-medium flex items-center gap-1">
            <User className="h-3.5 w-3.5" /> Local emergency contact required for this state
          </p>
          <div>
            <label htmlFor="ismw-ec-name" className="block text-xs font-medium text-muted mb-1">Emergency Contact Name *</label>
            <input
              id="ismw-ec-name"
              type="text"
              value={form.localEmergencyContact ?? ''}
              onChange={e => set('localEmergencyContact', e.target.value)}
              placeholder="Name of local contact"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {errors.localEmergencyContact && <p className="text-xs text-red-500 mt-1">{errors.localEmergencyContact}</p>}
          </div>
          <div>
            <label htmlFor="ismw-ec-phone" className="block text-xs font-medium text-muted mb-1">Emergency Contact Phone *</label>
            <input
              id="ismw-ec-phone"
              type="tel"
              value={form.localEmergencyPhone ?? ''}
              onChange={e => set('localEmergencyPhone', e.target.value)}
              placeholder="10-digit mobile"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {errors.localEmergencyPhone && <p className="text-xs text-red-500 mt-1">{errors.localEmergencyPhone}</p>}
          </div>
        </div>
      )}

      {/* Rent receipt / hostel letter upload */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <p className="text-xs font-medium text-muted flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" /> Proof of Local Residence *
          <span className="text-muted/70">(rent receipt, hostel letter, or employer accommodation letter)</span>
        </p>
        <label
          htmlFor="ismw-rent-receipt"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-accent/40 text-accent text-sm font-medium hover:bg-accent/10 transition-colors cursor-pointer w-fit"
        >
          <Upload className="h-4 w-4" />
          {rentReceiptName ? rentReceiptName : 'Upload Document'}
        </label>
        <input
          id="ismw-rent-receipt"
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        {form.rentReceiptDataUrl && !errors.rentReceipt && (
          <div className="flex items-center gap-1.5 text-xs text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" /> Document uploaded
          </div>
        )}
        {errors.rentReceipt && <p className="text-xs text-red-500">{errors.rentReceipt}</p>}
      </div>

      {/* Geo-tagged selfie */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <p className="text-xs font-medium text-muted flex items-center gap-1">
          <Camera className="h-3.5 w-3.5" /> Geo-Tagged Selfie at Local Address *
        </p>
        {selfie ? (
          <div className="flex items-center gap-3">
            <img src={selfie.dataUrl} alt="Local selfie" className="w-14 h-14 rounded-lg object-cover border border-border" />
            <div className="text-xs text-muted">
              <p className="text-green-400 font-medium flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Selfie captured</p>
              <p className="flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {selfie.latitude.toFixed(4)}, {selfie.longitude.toFixed(4)}</p>
              <button onClick={() => { setSelfie(null); setForm(prev => ({ ...prev, geoTaggedSelfie: undefined })); }} className="text-red-400 mt-1 flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Retake
              </button>
            </div>
          </div>
        ) : (
          <button
            id="ismw-selfie-btn"
            type="button"
            onClick={handleSelfie}
            disabled={isTakingSelfie}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/10 transition-colors disabled:opacity-50 w-fit"
          >
            {isTakingSelfie ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {isTakingSelfie ? 'Opening camera…' : 'Take Selfie at Local Address'}
          </button>
        )}
        {selfieError && <p className="text-xs text-red-500">{selfieError}</p>}
        {errors.selfie && !selfie && <p className="text-xs text-red-500">{errors.selfie}</p>}
      </div>

      {/* Submit */}
      <button
        id="ismw-local-submit-btn"
        type="button"
        onClick={handleSubmit}
        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-500 transition-colors"
      >
        <CheckCircle2 className="h-4 w-4" />
        Save Local Address &amp; Continue
      </button>
    </div>
  );
};

export default ISMWLocalAddressCapture;
