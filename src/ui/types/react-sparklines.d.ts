declare module 'react-sparklines' {
  import * as React from 'react';

  interface SparklinesProps {
    data: number[];
    width?: number;
    height?: number;
    margin?: number;
    limit?: number;
    max?: number;
    min?: number;
    children?: React.ReactNode;
  }

  interface SparklinesLineProps {
    color?: string;
    style?: React.CSSProperties;
  }

  interface SparklinesBarsProps {
    color?: string;
    style?: React.CSSProperties;
  }

  export class Sparklines extends React.Component<SparklinesProps> {}
  export class SparklinesLine extends React.Component<SparklinesLineProps> {}
  export class SparklinesBars extends React.Component<SparklinesBarsProps> {}
}
