import {EyeOff} from 'lucide-react';
import type {Item} from '@/lib/types';

export function SpoilerBadge({item}:{item:Item}){
  return item.article?.spoiler?<span className="article-spoiler-badge"><EyeOff size={12} aria-hidden="true"/>含剧透</span>:null;
}
