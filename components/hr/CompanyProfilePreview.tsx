import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getCleanFilename } from '../../utils/fileUrl';
import type { Company } from '../../types';
import { Mail, Phone, MapPin, Globe, Award, Calendar, ShieldCheck, FileText, Eye } from 'lucide-react';

interface CompanyProfilePreviewProps {
  data: Partial<Company>;
  logoUrl?: string;
}

const CompanyProfilePreview: React.FC<CompanyProfilePreviewProps> = ({ data, logoUrl }) => {
  const navigate = useNavigate();

  const handleViewDoc = (url: string, title?: string) => {
    const proxyUrl = getProxyUrl(url);
    const cleanName = getCleanFilename(title || url);
    const params = new URLSearchParams({
      url: proxyUrl,
      title: cleanName
    });
    navigate(`/document-viewer?${params.toString()}`);
  };
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
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Registration & Statutory Details</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="space-y-2">
                <p><span className="font-semibold text-muted">Registration Type:</span> {data.registrationType || 'N/A'}</p>
                <p><span className="font-semibold text-muted">Registration Number:</span> {data.registrationNumber || 'N/A'}</p>
                {data.cinNumber && <p><span className="font-semibold text-muted">CIN Number:</span> {data.cinNumber}</p>}
                {data.dinNumber && <p><span className="font-semibold text-muted">DIN Number:</span> {data.dinNumber}</p>}
                {data.tinNumber && <p><span className="font-semibold text-muted">TIN Number:</span> {data.tinNumber}</p>}
              </div>
              <div className="space-y-2">
                <p><span className="font-semibold text-muted">PAN Number:</span> {data.panNumber || 'N/A'}</p>
                <p><span className="font-semibold text-muted">GST Number:</span> {data.gstNumber || 'N/A'}</p>
                {data.udyogNumber && <p><span className="font-semibold text-muted">Udyog Number:</span> {data.udyogNumber}</p>}
                <p><span className="font-semibold text-muted">E-Shram Number:</span> {data.complianceCodes?.eShramNumber || 'N/A'}</p>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-2 pt-2 border-t border-dotted border-muted/30">
                <p><span className="font-semibold text-muted">EPFO Code:</span> {data.complianceCodes?.epfoCode || 'N/A'}</p>
                <p><span className="font-semibold text-muted">ESIC Code:</span> {data.complianceCodes?.esicCode || 'N/A'}</p>
                <p><span className="font-semibold text-muted">S & E Code:</span> {data.complianceCodes?.shopAndEstablishmentCode || 'N/A'} {data.complianceCodes?.shopAndEstablishmentValidTill && `(Valid till: ${data.complianceCodes.shopAndEstablishmentValidTill})`}</p>
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
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted mt-1">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> 
                        {docCount > 0 ? `${docCount} Doc` : 'Missing'}
                        {docCount > 0 && doc.documentUrls?.map((url, idx) => (
                          <button key={idx} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewDoc(url, doc.type); }} className="text-blue-500 hover:text-blue-700 ml-1 cursor-pointer" title="View Document">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                      {doc.effectiveDate && <span>Eff: {doc.effectiveDate}</span>}
                      {doc.announcedDate && <span>Ann: {doc.announcedDate}</span>}
                      {doc.expiryDate && <span className="flex items-center gap-1 text-accent font-semibold"><Calendar className="w-3 h-3" /> Exp: {doc.expiryDate}</span>}
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-muted">No compliance documents listed</p>}
            </div>
          </div>

          {/* Section 4: Removed Holidays Calendar per request */}

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
                            {docCount > 0 && (
                              <div className="text-[10px] text-muted flex items-center gap-1">
                                <FileText className="w-3 h-3" /> {docCount} attachment{docCount > 1 ? 's' : ''}
                                {ins.documentUrls?.map((url, idx) => (
                                  <button key={idx} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewDoc(url, ins.name); }} className="text-blue-500 hover:text-blue-700 ml-1 cursor-pointer" title="View Document">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {(ins.effectiveDate || ins.announcedDate) && (
                            <div className="flex gap-2 text-[9px] text-muted mt-0.5 opacity-70">
                                {ins.effectiveDate && <span>Eff: {ins.effectiveDate}</span>}
                                {ins.announcedDate && <span>Ann: {ins.announcedDate}</span>}
                            </div>
                          )}
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
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>{docCount > 0 ? `${docCount} Attachment${docCount > 1 ? 's' : ''}` : 'No document'}</span>
                            {docCount > 0 && pol.documentUrls?.map((url, idx) => (
                              <button key={idx} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewDoc(url, pol.name); }} className="text-blue-500 hover:text-blue-700 ml-1 cursor-pointer" title="View Document">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            ))}
                          </div>
                          {pol.effectiveDate && <span className="ml-2">Eff: {pol.effectiveDate}</span>}
                          {pol.announcedDate && <span className="ml-2">Ann: {pol.announcedDate}</span>}
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
