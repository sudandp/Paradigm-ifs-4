import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getCleanFilename } from '../../utils/fileUrl';
import type { Entity } from '../../types';
import { Mail, Phone, MapPin, Globe, Award, Calendar, ShieldCheck, FileText, Eye, Building } from 'lucide-react';

interface EntityProfilePreviewProps {
  data: Partial<Entity>;
  logoUrl?: string;
}

const EntityProfilePreview: React.FC<EntityProfilePreviewProps> = ({ data, logoUrl }) => {
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
            <h1 className="text-3xl font-bold text-primary-text mb-2">{data.name || 'Society/Site Name'}</h1>
            <div className="flex items-center text-muted text-sm gap-2 mb-1">
              <MapPin className="w-4 h-4" />
              <span>{data.registeredAddress || 'Registered Address not provided'}</span>
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
              <img src={getProxyUrl(logoUrl)} alt="Logo" className="max-w-full max-h-full object-contain" />
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
                {data.tanNumber && <p><span className="font-semibold text-muted">TAN Number:</span> {data.tanNumber}</p>}
              </div>
              <div className="space-y-2">
                <p><span className="font-semibold text-muted">PAN Number:</span> {data.panNumber || 'N/A'}</p>
                <p><span className="font-semibold text-muted">GST Number:</span> {data.gstNumber || 'N/A'}</p>
                {data.udyogNumber && <p><span className="font-semibold text-muted">Udyog Number:</span> {data.udyogNumber}</p>}
                <p><span className="font-semibold text-muted">E-Shram Number:</span> {data.eShramNumber || 'N/A'}</p>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-2 pt-2 border-t border-dotted border-muted/30">
                <p><span className="font-semibold text-muted">EPFO Code:</span> {data.epfoCode || 'N/A'}</p>
                <p><span className="font-semibold text-muted">ESIC Code:</span> {data.esicCode || 'N/A'}</p>
                <p><span className="font-semibold text-muted">S & E Code:</span> {data.shopAndEstablishmentCode || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Site Management */}
          <div className="col-span-1">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Management</h2>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold text-muted">Project Type:</span> {data.siteManagement?.projectType || 'N/A'}</p>
              <p><span className="font-semibold text-muted">Area:</span> {data.siteManagement?.siteAreaSqFt || '0'} Sq.ft</p>
              <p><span className="font-semibold text-muted">Units:</span> {data.siteManagement?.unitCount || '0'}</p>
              <p><span className="font-semibold text-muted">KAM:</span> {data.siteManagement?.keyAccountManager || 'N/A'}</p>
            </div>
          </div>

          {/* Section 3: Compliance Status */}
          <div className="col-span-1">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Compliance</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${data.complianceDetails?.form6Applicable ? 'text-green-500' : 'text-muted'}`} />
                <span>Form 6: {data.complianceDetails?.form6Applicable ? 'Applicable' : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${data.complianceDetails?.minWageRevisionApplicable ? 'text-green-500' : 'text-muted'}`} />
                <span>Min Wage: {data.complianceDetails?.minWageRevisionApplicable ? 'Applicable' : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Agreement Details */}
          <div className="col-span-2">
            <h2 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-2 mb-4 uppercase tracking-wider">Agreement Information</h2>
            <div className="space-y-4">
              {data.agreements && data.agreements.length > 0 ? data.agreements.map((agr, idx) => (
                <div key={agr.id} className="border border-border p-4 rounded-lg bg-page/10">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted font-semibold">Duration</p>
                      <p>{agr.fromDate || 'N/A'} to {agr.toDate || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted font-semibold">Agreement Date</p>
                      <p>{agr.agreementDate || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted font-semibold">Renewal Trigger</p>
                      <p>{agr.renewalTriggerDays || '0'} Days</p>
                    </div>
                  </div>
                </div>
              )) : <p className="text-sm text-muted">No agreement details provided</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-center text-[10px] text-muted uppercase tracking-[0.2em]">
          Paradigm Integrated Facility Services • Site/Society Documentation • Confidential
        </div>
      </div>
    </div>
  );
};

export default EntityProfilePreview;
