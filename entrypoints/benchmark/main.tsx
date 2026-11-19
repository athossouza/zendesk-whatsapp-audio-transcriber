import { render } from 'preact';
import { BenchApp } from './BenchApp';

const root = document.getElementById('app');
if (root) render(<BenchApp />, root);
