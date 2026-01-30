import ExamQuestionWrapper from '@/core/components/exam/questions/ExamQuestionWrapper'

export default ({ id }: { id: number }) => {
  return <ExamQuestionWrapper showEditor={false} id={id} />
}
