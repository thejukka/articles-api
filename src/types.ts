export interface Article {
    id?: number;
    url: string;
    title?: string;
    words?: number;
    section?: number;
    content?: string;        
}

export interface Section {
    id: number;
    title: string;
    name: string;
}
