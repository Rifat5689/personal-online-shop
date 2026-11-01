import React,{createContext,useContext} from 'react';
import {useQuery} from '@tanstack/react-query';
import {request} from '../../services/api';
const Context=createContext(null);
export function StoreProvider({children}){const storeSlug='originsofbeauty';const query=useQuery({queryKey:['store',storeSlug],queryFn:()=>request('get','/stores/slug/originsofbeauty')});return <Context.Provider value={{storeSlug,store:query.data,query}}>{children}</Context.Provider>;}
export const useStore=()=>useContext(Context);