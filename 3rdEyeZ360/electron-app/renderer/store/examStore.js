import { create } from 'zustand'

const useExamStore = create((set) => ({
  currentExam: null,
  currentAssessment: null,
  examStatus: null,
  warningCounts: {},
  violationCount: 0,
  isLocked: false,

  setExam: (exam) => set({ currentExam: exam }),
  setAssessment: (assessment) => set({ currentAssessment: assessment }),
  setExamStatus: (status) => set({ examStatus: status }),
  addWarning: (detail) => set((state) => ({
    warningCounts: {
      ...state.warningCounts,
      [detail]: (state.warningCounts[detail] || 0) + 1
    }
  })),
  incrementViolation: () => set((state) => ({ violationCount: state.violationCount + 1 })),
  setLocked: (val) => set({ isLocked: val }),
  reset: () => set({ currentExam: null, currentAssessment: null, examStatus: null,
                      warningCounts: {}, violationCount: 0, isLocked: false })
}))

export default useExamStore