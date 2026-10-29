import {
    Text, AlignLeft, Hash, Mail, Star, BarChart3, ToggleLeft,
    Filter, CircleDot, CheckSquare, Calendar, Clock, Upload,
    PenTool, Image, MousePointer
} from 'lucide-react';

export const FIELD_CATEGORIES = [
    { id: 'basic', label: 'Basic Inputs' },
    { id: 'evaluation', label: 'Evaluation' },
    { id: 'choices', label: 'Choices' },
    { id: 'time', label: 'Time & Date' },
    { id: 'advanced', label: 'Advanced' },
];

export const FIELD_TYPES = [
    { type: 'text', label: 'Short Text', icon: Text, category: 'basic', description: 'Single line text input' },
    { type: 'textarea', label: 'Long Text', icon: AlignLeft, category: 'basic', description: 'Multi-line text area' },
    { type: 'number', label: 'Number', icon: Hash, category: 'basic', description: 'Numeric input' },
    { type: 'email', label: 'Email Address', icon: Mail, category: 'basic', description: 'Email input with validation' },
    { type: 'rating', label: 'Star Rating', icon: Star, category: 'evaluation', description: 'Star-based rating' },
    { type: 'nps', label: 'NPS Scale (0-10)', icon: BarChart3, category: 'evaluation', description: 'Net Promoter Score' },
    { type: 'yesno', label: 'Yes/No Toggle', icon: ToggleLeft, category: 'evaluation', description: 'Binary choice' },
    { type: 'segmented', label: 'Priority Picker', icon: Filter, category: 'evaluation', description: 'Segmented options' },
    { type: 'slider', label: 'Range Slider', icon: BarChart3, category: 'evaluation', description: 'Slider with min/max' },
    { type: 'dropdown', label: 'Dropdown', icon: CircleDot, category: 'choices', description: 'Select from dropdown' },
    { type: 'radio', label: 'Radio Buttons', icon: CircleDot, category: 'choices', description: 'Single selection' },
    { type: 'checkbox', label: 'Checkboxes', icon: CheckSquare, category: 'choices', description: 'Multiple selection' },
    { type: 'date', label: 'Date Picker', icon: Calendar, category: 'time', description: 'Date selection' },
    { type: 'time', label: 'Time Picker', icon: Clock, category: 'time', description: 'Time selection' },
    { type: 'upload', label: 'File Upload', icon: Upload, category: 'advanced', description: 'File upload area' },
    { type: 'signature', label: 'Signature', icon: PenTool, category: 'advanced', description: 'Signature pad' },
    { type: 'carousel', label: 'Image Carousel', icon: Image, category: 'advanced', description: 'Image slideshow' },
    { type: 'button', label: 'Button', icon: MousePointer, category: 'advanced', description: 'Action button' },
];
