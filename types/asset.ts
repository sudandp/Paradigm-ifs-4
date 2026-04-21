import { UploadedFile } from './common';

// Asset Management Types

export type AssetCondition = 'New' | 'Used' | '';

export type DamageStatus = 'With Damages' | 'Without Damages' | '';

export interface PhoneAsset {
  id: string;
  type: 'Phone';
  brand: string | null;
  condition: AssetCondition | null;
  chargerStatus: 'With Charger' | 'Without Charger' | '' | null;
  displayStatus: DamageStatus | null;
  bodyStatus: DamageStatus | null;
  imei: string | null;
  color: string | null;
  picture?: UploadedFile | null;
}

export interface SimAsset {
  id: string;
  type: 'Sim';
  number: string | null;
}

export interface ComputerAsset {
  id: string;
  type: 'Computer';
  computerType: 'Laptop' | 'Desktop' | 'Tab' | '' | null;
  brand: string | null;
  condition: AssetCondition | null;
  bagStatus: 'With Bag' | 'Without Bag' | '' | null;
  mouseStatus: 'With Mouse' | 'Without Mouse' | '' | null;
  chargerStatus: 'With Charger' | 'Without Charger' | '' | null;
  displayStatus: DamageStatus | null;
  bodyStatus: DamageStatus | null;
  serialNumber: string | null;
  windowsKey: string | null;
  officeStatus: 'With Office' | 'Without Office' | '' | null;
  antivirusStatus: 'With Antivirus' | 'Without Antivirus' | '' | null;
  picture?: UploadedFile | null;
}

export interface IdCardAsset {
  id: string;
  type: 'IdCard';
  issueDate: string | null;
}

export interface PetrocardAsset {
  id: string;
  type: 'Petrocard';
  number: string | null;
}

export interface VehicleAsset {
  id: string;
  type: 'Vehicle';
  vehicleType: 'Bicycle' | 'Two Wheeler' | 'Three Wheeler' | 'Four Wheeler' | '' | null;
  brand: string | null;
  dlNumber: string | null;
  dlFrontPic?: UploadedFile | null;
  dlBackPic?: UploadedFile | null;
  condition: AssetCondition | null;
  kmsAtIssue: number | null;
  vehicleNumber: string | null;
  chassisNumber: string | null;
  insuranceValidity: string | null;
  pollutionCertValidity: string | null;
  finesStatus: 'Existing' | 'Nil' | '' | null;
  picture?: UploadedFile | null;
}

export interface ToolAssetItem {
  id: string;
  name: string | null;
  description: string | null;
  quantity: number | null;
}

export interface ToolsAsset {
  id: string;
  type: 'Tools';
  toolList: ToolAssetItem[] | null;
  picture?: UploadedFile | null;
}

export interface OtherAsset {
  id: string;
  type: 'Other';
  name: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  condition: AssetCondition | null;
  issueCondition: string | null;
  accessories: string | null;
  picture?: UploadedFile | null;
}

export type Asset = PhoneAsset | SimAsset | ComputerAsset | IdCardAsset | PetrocardAsset | VehicleAsset | ToolsAsset | OtherAsset;
