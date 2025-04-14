import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Img,
  Section,
} from '@react-email/components';
import { EmailTemplateProps } from '@/types/email/moderation.types';

export default function EmailLayout({ preview, children }: EmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.logoSection}>
            <Img
              src={`${process.env.NEXT_PUBLIC_APP_URL}/mainlogo.png`}
              width="150"
              height="50"
              alt="AiEdify"
              style={styles.logo}
            />
          </Section>
          {children}
          <Section style={styles.footer}>
            <p style={styles.footerText}>© {new Date().getFullYear()} AiEdify. All rights reserved.</p>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  main: {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '0 0 48px',
    marginBottom: '64px',
    borderRadius: '5px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
  },
  logoSection: {
    textAlign: 'center' as const,
    padding: '20px 0',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '20px',
  },
  logo: {
    margin: '0 auto',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '0 48px',
    marginTop: '32px',
  },
  footerText: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '0',
  },
}; 