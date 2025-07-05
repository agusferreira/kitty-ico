import { FC } from 'react'
import kittyIcos from './kitty-icos.png';

interface Props {
  className?: string
}

export const LogoIcon: FC<Props> = ({ className }) => {
  return (
    <img
      className={className}
      height="150"
      width="150"
      src={kittyIcos}
      alt="Kitty ICO"
    />
  )
}


