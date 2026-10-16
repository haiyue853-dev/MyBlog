import type {ItemImage,ItemInput} from './types';

export const MAX_DIARY_IMAGES=12;
export function appendItemPhoto(images:ItemImage[],photo:ItemImage):ItemImage[]{return images.some(image=>image.assetId===photo.assetId)?images:[...images,photo];}

// Old diaries and collection cards still store only assetId and cover dimensions.
export function itemImages(item:Pick<ItemInput,'assetId'|'images'|'imageWidth'|'imageHeight'>):ItemImage[]{
  if(item.images?.length)return item.images;
  return item.assetId?[{assetId:item.assetId,width:item.imageWidth,height:item.imageHeight}]:[];
}

// Keep the legacy cover column and every photo in the JSON in the same permission query.
export const ITEM_ASSET_REFERENCE_SQL=`(asset_id=? OR json_extract(items.data,'$.video.assetId')=? OR EXISTS (
  SELECT 1 FROM json_each(items.data, '$.images') AS photo
  WHERE json_extract(photo.value, '$.assetId')=?
))`;
export const USED_ITEM_ASSETS_SQL=`SELECT asset_id AS id FROM items WHERE asset_id IS NOT NULL
  UNION SELECT json_extract(data,'$.video.assetId') AS id FROM items WHERE json_extract(data,'$.video.assetId') IS NOT NULL
  UNION SELECT json_extract(photo.value, '$.assetId') AS id
  FROM items, json_each(items.data, '$.images') AS photo`;
