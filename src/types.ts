type JobStage =
  | 'queued'
  | 'fetching'
  | 'parsing'
  | 'saving'
  | 'done'
  | 'error';

export interface Article {
    id?: number;
    url: string;
    title?: string;
    words?: number;
    section?: number | null;
    content?: string;        
}

export interface Section {
    id: number;
    title: string;
    name: string;
}

export interface JobStatus {
  id: string;
  status: JobStage;
  error?: string;
  code?: number;
}
