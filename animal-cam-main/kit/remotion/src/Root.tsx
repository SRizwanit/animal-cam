import React from 'react';
import {Composition, Still, CalculateMetadataFunction} from 'remotion';
import {UniqueVideo} from './UniqueVideo';
import {Thumbnail} from './Thumbnail';
import {KitProps, defaultProps} from './types';

// Python এর দেওয়া props থেকে size/fps/duration বসায়
const calc: CalculateMetadataFunction<KitProps> = ({props}) => ({
  width: props.width,
  height: props.height,
  fps: props.fps,
  durationInFrames: Math.max(1, Math.round(props.durationSec * props.fps)),
});

export const Root: React.FC = () => (
  <>
    <Composition
      id="UniqueVideo"
      component={UniqueVideo}
      width={defaultProps.width}
      height={defaultProps.height}
      fps={defaultProps.fps}
      durationInFrames={defaultProps.durationSec * defaultProps.fps}
      defaultProps={defaultProps}
      calculateMetadata={calc}
    />
    <Still
      id="Thumbnail"
      component={Thumbnail}
      width={defaultProps.width}
      height={defaultProps.height}
      defaultProps={defaultProps}
      calculateMetadata={({props}) => ({width: props.width, height: props.height})}
    />
  </>
);
