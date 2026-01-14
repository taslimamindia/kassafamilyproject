import { getJson } from './api'

export interface RawUser {
    id: number;
    firstname: string;
    lastname: string;
    role: string | null;
    image_url: string | null;
    birthday: string | null;
    id_father: number | null;
    id_mother: number | null;
    father_name: string | null;
    mother_name: string | null;
}

export const fetchRawUsers = async (): Promise<RawUser[]> => {
    return await getJson<RawUser[]>('/tree')
}