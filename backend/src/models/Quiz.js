import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true,
    validate: v => Array.isArray(v) && v.length >= 2
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: 0
  }
});

const quizSchema = new mongoose.Schema(
  {
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    passingScore: {
      type: Number,
      default: 60 // 60%
    },
    questions: [questionSchema]
  },
  { timestamps: true }
);

const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
