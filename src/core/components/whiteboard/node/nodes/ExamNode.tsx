import Exam from '@/core/components/exam'

export default ({ id }: { id: number }) => {
  return (
    <Exam
      layout={{
        headerOnlyModeSwitcher: true
      }}
      id={id}
    />
  )
}
