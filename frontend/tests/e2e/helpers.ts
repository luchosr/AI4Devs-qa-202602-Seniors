import { Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3010';

export interface TestCandidate {
  id: string;
  name: string;
  email: string;
  phase: string;
}

export interface TestPosition {
  id: string;
  title: string;
}

export class TestDataManager {
  constructor(private page: Page) {}

  async createPosition(title: string): Promise<TestPosition> {
    const response = await this.page.request.post(`${API_BASE_URL}/positions`, {
      data: {
        title,
        companyId: 1,
        interviewFlowId: 1,
        description: 'Test position',
        location: 'Remote',
        jobDescription: 'Test job description',
      },
    });
    if (!response.ok()) {
      const errorBody = await response.text();
      console.error(`API Error ${response.status()}:`, errorBody);
      throw new Error(`Failed to create position: ${response.status()} - ${errorBody}`);
    }
    const result = await response.json();
    return result.data || result;
  }

  private mapSpanishPhaseToEnglish(spanishPhase: string): string {
    const phaseMap: { [key: string]: string } = {
      'Aplicado': 'Initial Screening',
      'Entrevista': 'Technical Interview',
      'Prueba Técnica': 'Manager Interview',
      'Oferta': 'Manager Interview',
      'Contratado': 'Manager Interview',
      'Rechazado': 'Initial Screening',
    };
    return phaseMap[spanishPhase] || spanishPhase;
  }

  async createCandidate(
    positionId: string,
    name: string,
    email: string,
    phase: string
  ): Promise<TestCandidate> {
    const [firstName, lastName] = name.split(' ');
    // Generate unique email to avoid duplicates
    const uniqueEmail = email.replace('@', `+${Date.now()}-${Math.random().toString(36).substr(2, 9)}@`);

    // Create candidate
    const response = await this.page.request.post(`${API_BASE_URL}/candidates`, {
      data: {
        firstName: firstName || name,
        lastName: lastName || '',
        email: uniqueEmail,
        phone: '612345678',
      },
    });
    if (!response.ok()) {
      const errorText = await response.text();
      console.error(`Candidate creation error (${response.status()}):`, errorText);
      throw new Error(`Failed to create candidate: ${response.status()} - ${errorText}`);
    }
    const result = await response.json();
    const candidate = result.data || result;
    const candidateId = candidate.id?.toString() || '';

    // Get the interview step ID for the phase
    const positionResponse = await this.page.request.get(`${API_BASE_URL}/positions/${positionId}/interviewflow`);
    if (!positionResponse.ok()) {
      throw new Error(`Failed to get interview flow: ${positionResponse.status()}`);
    }
    const positionData = await positionResponse.json();
    // Safely extract interviewSteps, handling multiple possible API response shapes
    const interviewSteps =
      positionData.interviewFlow?.interviewSteps ||
      positionData.interviewFlow?.data?.interviewSteps ||
      positionData.interviewFlow?.interviewFlow?.interviewSteps ||
      [];

    // Try to find exact phase match first, then try mapped phase
    const mappedPhase = this.mapSpanishPhaseToEnglish(phase);
    const stepForPhase = interviewSteps.find((step: any) => step.name === phase || step.name === mappedPhase);
    const interviewStepId = stepForPhase?.id || interviewSteps[0]?.id || 1;

    // Create application to link candidate with position
    const appResponse = await this.page.request.post(`${API_BASE_URL}/applications`, {
      data: {
        candidateId,
        positionId,
        currentInterviewStep: interviewStepId,
      },
    });
    if (!appResponse.ok()) {
      const errorText = await appResponse.text();
      throw new Error(`Failed to create application: ${appResponse.status()}`);
    }

    return {
      id: candidateId,
      name,
      email: uniqueEmail,
      phase,
    };
  }

  async updateCandidatePhase(
    candidateId: string,
    newPhase: string
  ): Promise<TestCandidate> {
    const response = await this.page.request.put(
      `${API_BASE_URL}/candidates/${candidateId}`,
      {
        data: { phase: newPhase },
      }
    );
    if (!response.ok()) {
      throw new Error(`Failed to update candidate phase: ${response.status()}`);
    }
    return response.json();
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    const response = await this.page.request.delete(
      `${API_BASE_URL}/candidates/${candidateId}`
    );
    if (!response.ok()) {
      throw new Error(`Failed to delete candidate: ${response.status()}`);
    }
  }

  async deletePosition(positionId: string): Promise<void> {
    const response = await this.page.request.delete(
      `${API_BASE_URL}/positions/${positionId}`
    );
    if (!response.ok()) {
      throw new Error(`Failed to delete position: ${response.status()}`);
    }
  }

  async getPosition(positionId: string): Promise<TestPosition> {
    const response = await this.page.request.get(
      `${API_BASE_URL}/positions/${positionId}`
    );
    if (!response.ok()) {
      throw new Error(`Failed to fetch position: ${response.status()}`);
    }
    return response.json();
  }

  async getCandidates(positionId: string): Promise<TestCandidate[]> {
    const response = await this.page.request.get(
      `${API_BASE_URL}/positions/${positionId}/candidates`
    );
    if (!response.ok()) {
      throw new Error(`Failed to fetch candidates: ${response.status()}`);
    }
    return response.json();
  }
}
