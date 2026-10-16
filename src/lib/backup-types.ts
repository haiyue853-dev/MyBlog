export interface BackupInfo {
  id:string;
  createdAt:string;
  size:number;
  collectionCount:number;
  momentCount:number;
  videoCount?:number;
  assetCount:number;
}
