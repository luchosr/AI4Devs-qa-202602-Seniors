import { PrismaClient } from '@prisma/client';
import { Position } from '../../domain/models/Position';

const prisma = new PrismaClient();

const calculateAverageScore = (interviews: any[]) => {
    if (interviews.length === 0) return 0;
    const totalScore = interviews.reduce((acc, interview) => acc + (interview.score || 0), 0);
    return totalScore / interviews.length;
};

export const getCandidatesByPositionService = async (positionId: number) => {
    try {
        const applications = await prisma.application.findMany({
            where: { positionId },
            include: {
                candidate: true,
                interviews: true,
                interviewStep: true
            }
        });

        return applications.map(app => ({
            fullName: `${app.candidate.firstName} ${app.candidate.lastName}`,
            currentInterviewStep: app.interviewStep.name,
            candidateId: app.candidateId,
            applicationId: app.id,
            averageScore: calculateAverageScore(app.interviews)
        }));
    } catch (error) {
        console.error('Error retrieving candidates by position:', error);
        throw new Error('Error retrieving candidates by position');
    }
};

export const getInterviewFlowByPositionService = async (positionId: number) => {
    const positionWithInterviewFlow = await prisma.position.findUnique({
        where: { id: positionId },
        include: {
            interviewFlow: {
                include: {
                    interviewSteps: true
                }
            }
        }
    });

    if (!positionWithInterviewFlow) {
        throw new Error('Position not found');
    }

    // Formatear la respuesta para incluir el nombre de la posición y el flujo de entrevistas
    return {
        positionName: positionWithInterviewFlow.title,
        interviewFlow: {
            id: positionWithInterviewFlow.interviewFlow.id,
            description: positionWithInterviewFlow.interviewFlow.description,
            interviewSteps: positionWithInterviewFlow.interviewFlow.interviewSteps.map(step => ({
                id: step.id,
                interviewFlowId: step.interviewFlowId,
                interviewTypeId: step.interviewTypeId,
                name: step.name,
                orderIndex: step.orderIndex
            }))
        }
    };
};

export const getAllPositionsService = async () => {
    try {
        return await prisma.position.findMany({
            where: { isVisible: true }
        });
    } catch (error) {
        console.error('Error retrieving all positions:', error);
        throw new Error('Error retrieving all positions');
    }
};

export const createPositionService = async (positionData: any) => {
    try {
        // Ensure InterviewType exists first (use upsert to avoid race conditions)
        const interviewType = await prisma.interviewType.upsert({
            where: { id: 1 },
            update: {},
            create: {
                id: 1,
                name: 'Technical Interview'
            }
        }).catch(() =>
            prisma.interviewType.findFirst() ||
            prisma.interviewType.create({ data: { name: 'Technical Interview' } })
        );

        // Ensure company exists (use upsert to avoid race conditions)
        const company = await prisma.company.upsert({
            where: { id: 1 },
            update: {},
            create: {
                id: 1,
                name: 'Default Company'
            }
        }).catch(() =>
            prisma.company.findFirst() ||
            prisma.company.create({ data: { name: 'Default Company' } })
        );

        // Ensure interview flow exists (use upsert to avoid race conditions)
        const interviewFlow = await prisma.interviewFlow.upsert({
            where: { id: 1 },
            update: {},
            create: {
                id: 1,
                description: 'Default Interview Flow',
                interviewSteps: {
                    create: [
                        { name: 'Aplicado', interviewTypeId: 1, orderIndex: 1 },
                        { name: 'Entrevista', interviewTypeId: 1, orderIndex: 2 },
                        { name: 'Prueba Técnica', interviewTypeId: 1, orderIndex: 3 },
                        { name: 'Oferta', interviewTypeId: 1, orderIndex: 4 },
                        { name: 'Contratado', interviewTypeId: 1, orderIndex: 5 },
                        { name: 'Rechazado', interviewTypeId: 1, orderIndex: 6 },
                    ]
                }
            }
        }).catch(() =>
            prisma.interviewFlow.findFirst() ||
            prisma.interviewFlow.create({ data: { description: 'Default Interview Flow' } })
        );

        const positionWithDefaults = {
            ...positionData,
            companyId: positionData.companyId || company!.id,
            interviewFlowId: positionData.interviewFlowId || interviewFlow!.id,
        };

        const position = new Position(positionWithDefaults);
        return await position.save();
    } catch (error) {
        console.error('Error creating position:', error);
        throw new Error(`Error creating position: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const deletePositionService = async (id: number) => {
    try {
        await Position.delete(id);
    } catch (error) {
        console.error('Error deleting position:', error);
        throw new Error('Error deleting position');
    }
};