export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

 export interface SampleEmail {
  type: 'invitation' | 'welcome';
  title: string;
  description: string;
  data: EmailData;
}

 export interface InviteConfig {
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  inviteCode: string;
  joinUrl: string;
  expirationDate: Date;
  personalMessage?: string;
}