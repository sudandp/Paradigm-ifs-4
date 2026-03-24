import React from 'react';
import type { Company } from '../../types';
import { Mail, Phone, MapPin, Globe, Award, Calendar, ShieldCheck, FileText } from 'lucide-react';

interface CompanyProfilePreviewProps {
  data: Partial<Company>;
  logoUrl?: string;
}

const CompanyProfilePreview: React.FC<CompanyProfilePreviewProps> = ({ data, logoUrl }) => {
  return (
    <div className="bg-gray-100 p-8 flex justify-center overflow-auto min-h-screen">
      <div 
        className="bg-white shadow-2xl mx-auto p-[20mm] box-border print:shadow-none print:p-0"
        style={{
          width: '210mm',
          minHeight: '297mm',
          backgroundColor: 'white',
        }}
      >
        {/* Header Section */}
        <div className="flex justify-between items-start border-b-2 border-primary pb-8 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-primary-text mb-2">{data.name || 'Company Name'}</h1>
            <div className="flex items-center text-muted text-sm gap-2 mb-1">
              <MapPin className="w-4 h-4" />
              <span>{data.address || 'Registered Address not provided'}</span>
            </div>
            {data.location && (
              <div className="flex items-center text-muted text-sm gap-2">
                <Globe className="w-4 h-4" />
                <span>Location: {data.location}</span>
              </div>
            )}
          </div>
          <div className="w-32 h-32 flex items-center justify-center border border-border rounded-lg bg-page overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-muted text-xs text-center font-medium px-2">No Logo<br/>Provided</div>
            )}
          </div>
        </div>

        {/* Form Content Grid */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-8">
          
          {/* Section 1: Registration Details */}
          <div className="col-span-2">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Registration & Compliance</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p><span className="font-semibold text-muted">Registration Type:</span> {data.registrationType || 'N/A'}</p>
                <p><span className="font-semibold text-muted">Registration Number:</span> {data.registrationNumber || 'N/A'}</p>
                <p><span className="font-semibold text-muted">GST Number:</span> {data.gstNumber || 'N/A'}</p>
              </div>
              <div className="space-y-2">
                <p><span className="font-semibold text-muted">PAN Number:</span> {data.panNumber || 'N/A'}</p>
                <p><span className="font-semibold text-muted">E-Shram Number:</span> {data.complianceCodes?.eShramNumber || 'N/A'}</p>
                <p><span className="font-semibold text-muted">ESIC Code:</span> {data.complianceCodes?.esicCode || 'N/A'}</p>
              </div>
              <div className="col-span-2 space-y-2">
                <p><span className="font-semibold text-muted">Shop & Establishment Code:</span> {data.complianceCodes?.shopAndEstablishmentCode || 'N/A'}</p>
                <p><span className="font-semibold text-muted">EPFO Code:</span> {data.complianceCodes?.epfoCode || 'N/A'}</p>
                <p><span className="font-semibold text-muted">PSARA License:</span> {data.complianceCodes?.psaraLicenseNumber || 'N/A'} {data.complianceCodes?.psaraValidTill && `(Valid till: ${data.complianceCodes.psaraValidTill})`}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="col-span-1">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Official Contacts</h2>
            <div className="space-y-3">
              {data.emails && data.emails.length > 0 ? data.emails.map((email, i) => (
                <div key={email.id} className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-accent" />
                  <span>{email.email}</span>
                </div>
              )) : <p className="text-sm text-muted">No emails registered</p>}
            </div>
          </div>

          {/* Section 3: Document Status */}
          <div className="col-span-1">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Compliance Docs</h2>
            <div className="space-y-3">
              {data.complianceDocuments && data.complianceDocuments.length > 0 ? data.complianceDocuments.map((doc) => {
                const docCount = doc.documentUrls?.length || 0;
                return (
                  <div key={doc.id} className="flex flex-col border-b border-border pb-2 last:border-0">
                    <span className="text-sm font-medium">{doc.type}</span>
                    <div className="flex items-center gap-4 text-xs text-muted mt-1">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> 
                        {docCount > 0 ? `${docCount} Attachment${docCount > 1 ? 's' : ''}` : 'Missing'}
                      </span>
                      {doc.expiryDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Exp: {doc.expiryDate}</span>}
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-muted">No compliance documents listed</p>}
            </div>
          </div>

          {/* Section 4: Holidays */}
          <div className="col-span-2">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Holiday Calendar</h2>
            <div className="grid grid-cols-3 gap-4">
              {data.holidays && data.holidays.length > 0 ? data.holidays.map((hol) => (
                <div key={hol.id} className="flex items-center gap-3 p-3 border border-border rounded bg-page/30">
                  <div className="text-center">
                    <span className="block text-xs font-bold text-accent uppercase">{new Date(hol.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="block text-lg font-bold">{new Date(hol.date).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{hol.festivalName}</span>
                    <span className="block text-xs text-muted">{hol.year}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-muted col-span-3">No holidays defined</p>}
            </div>
          </div>

          {/* Section 5: Insurance & Internal Policies */}
          <div className="col-span-2">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Insurance & Policies</h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-bold text-muted mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Policies</h3>
                <ul className="space-y-2">
                  {data.insurances && data.insurances.length > 0 ? data.insurances.map(ins => {
                    const docCount = ins.documentUrls?.length || 0;
                    return (
                      <li key={ins.id} className="text-sm flex flex-col p-2 hover:bg-page/40 rounded transition-colors border-b border-border last:border-0">
                        <div className="flex justify-between items-center">
                          <span>{ins.name}</span>
                          {docCount > 0 && <span className="text-[10px] text-muted flex items-center gap-1"><FileText className="w-3 h-3" /> {docCount} attachment{docCount > 1 ? 's' : ''}</span>}
                        </div>
                      </li>
                    );
                  }) : <p className="text-sm text-muted">No policy records</p>}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold text-muted mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Company Policies</h3>
                <ul className="space-y-2">
                  {data.policies && data.policies.length > 0 ? data.policies.map(pol => {
                    const docCount = pol.documentUrls?.length || 0;
                    return (
                      <li key={pol.id} className="text-sm flex flex-col p-2 hover:bg-page/40 rounded transition-colors border-b border-border last:border-0">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{pol.name}</span>
                          <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded uppercase font-bold">{pol.level} Level</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted mt-1">
                          <FileText className="w-3 h-3" />
                          <span>{docCount > 0 ? `${docCount} Attachment${docCount > 1 ? 's' : ''}` : 'No document'}</span>
                        </div>
                      </li>
                    );
                  }) : <p className="text-sm text-muted">No company policies</p>}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-center text-[10px] text-muted uppercase tracking-[0.2em]">
          Paradigm Integrated Facility Services • Corporate Profile Documentation • Confidential
        </div>
      </div>
    </div>
  );
};

export default CompanyProfilePreview;
