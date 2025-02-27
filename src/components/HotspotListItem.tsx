import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Hotspot, Witness } from '@helium/http'
import animalName from 'angry-purple-tiger'
import { useTranslation } from 'react-i18next'
import CarotRight from '@assets/images/carot-right.svg'
import LocationIcon from '@assets/images/location-icon.svg'
import Balance, { NetworkTokens } from '@helium/currency'
import SkeletonPlaceholder from 'react-native-skeleton-placeholder'
import { Pressable } from 'react-native'
import Box from './Box'
import Text from './Text'
import useCurrency from '../utils/useCurrency'
import { isRelay } from '../utils/hotspotUtils'
import HexBadge from '../features/hotspots/details/HexBadge'
import { useColors } from '../theme/themeHooks'
import Signal from '../assets/images/signal.svg'

type HotspotListItemProps = {
  onPress?: (hotspot: Hotspot | Witness) => void
  hotspot: Hotspot | Witness
  totalReward?: Balance<NetworkTokens>
  showCarot?: boolean
  loading?: boolean
  showAddress?: boolean
  showRewardScale?: boolean
  distanceAway?: string
  showRelayStatus?: boolean
  showAntennaDetails?: boolean
  pressable?: boolean
}

const HotspotListItem = ({
  onPress,
  hotspot,
  totalReward,
  loading = false,
  showCarot = false,
  showAddress = true,
  showRewardScale = false,
  showRelayStatus = false,
  showAntennaDetails = false,
  pressable = true,
  distanceAway,
}: HotspotListItemProps) => {
  const { t } = useTranslation()
  const colors = useColors()
  const { toggleConvertHntToCurrency, hntBalanceToDisplayVal } = useCurrency()
  const handlePress = useCallback(() => onPress?.(hotspot), [hotspot, onPress])
  const [reward, setReward] = useState('')

  const updateReward = useCallback(async () => {
    if (!totalReward) return

    const nextReward = await hntBalanceToDisplayVal(totalReward, false)
    setReward(`+${nextReward}`)
  }, [hntBalanceToDisplayVal, totalReward])

  useEffect(() => {
    updateReward()
  }, [updateReward])

  const locationText = useMemo(() => {
    const { geocode: geo } = hotspot
    if (!geo || (!geo.longStreet && !geo.longCity && !geo.shortCountry)) {
      return t('hotspot_details.no_location_title')
    }
    return `${geo.longStreet}, ${geo.longCity}, ${geo.shortCountry}`
  }, [hotspot, t])

  const isRelayed = useMemo(() => isRelay(hotspot?.status?.listenAddrs), [
    hotspot?.status,
  ])

  return (
    <Box marginBottom="xxs">
      <Pressable onPress={handlePress} disabled={!pressable}>
        {({ pressed }) => (
          <Box
            backgroundColor={pressed ? 'grayHighlight' : 'grayBoxLight'}
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            padding="m"
            flex={1}
          >
            <Box flexDirection="column">
              <Box flexDirection="row" alignItems="center">
                <Box
                  height={10}
                  width={10}
                  borderRadius="m"
                  backgroundColor={
                    hotspot.status?.online === 'online'
                      ? 'greenOnline'
                      : 'yellow'
                  }
                />
                <Text
                  variant="body2Medium"
                  color="offblack"
                  paddingStart="s"
                  ellipsizeMode="tail"
                  numberOfLines={2}
                  maxWidth={210}
                >
                  {animalName(hotspot.address)}
                </Text>
              </Box>
              {showAddress && (
                <Text variant="body3Light" color="blueGray" marginTop="s">
                  {locationText}
                </Text>
              )}
              <Box flexDirection="row" alignItems="center" marginTop="s">
                {loading && !totalReward && (
                  <SkeletonPlaceholder speed={3000}>
                    <SkeletonPlaceholder.Item
                      height={15}
                      width={168.5}
                      borderRadius={4}
                    />
                  </SkeletonPlaceholder>
                )}
                {totalReward !== undefined && (
                  <>
                    <Text
                      onPress={toggleConvertHntToCurrency}
                      variant="body2"
                      color="grayDarkText"
                      paddingEnd="s"
                    >
                      {reward}
                    </Text>
                  </>
                )}
                {distanceAway !== undefined && (
                  <Box marginRight="s" flexDirection="row" alignItems="center">
                    <LocationIcon
                      color={colors.purpleMain}
                      width={10}
                      height={10}
                    />
                    <Text
                      color="grayText"
                      variant="regular"
                      fontSize={12}
                      marginLeft="xs"
                    >
                      {t('hotspot_details.distance_away', {
                        distance: distanceAway,
                      })}
                    </Text>
                  </Box>
                )}
                {showRewardScale && (
                  <HexBadge
                    rewardScale={hotspot.rewardScale}
                    pressable={false}
                    badge={false}
                    fontSize={12}
                  />
                )}
                {showAntennaDetails && (
                  <Box marginLeft="s" flexDirection="row" alignItems="center">
                    <Signal width={10} height={10} color={colors.grayText} />
                    <Text
                      color="grayText"
                      variant="regular"
                      fontSize={12}
                      marginLeft="xs"
                    >
                      {t('generic.meters', {
                        distance: hotspot?.elevation || 0,
                      })}
                    </Text>
                    {hotspot?.gain !== undefined && (
                      <Text
                        color="grayText"
                        variant="regular"
                        fontSize={12}
                        marginLeft="xs"
                      >
                        {(hotspot.gain / 10).toFixed(1) +
                          t('antennas.onboarding.dbi')}
                      </Text>
                    )}
                  </Box>
                )}
                {showRelayStatus && isRelayed && (
                  <Text
                    color="grayText"
                    variant="regular"
                    fontSize={12}
                    marginLeft="s"
                  >
                    {t('hotspot_details.relayed')}
                  </Text>
                )}
              </Box>
            </Box>
            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="center"
            >
              {showCarot && (
                <Box marginStart="m">
                  <CarotRight color="#C4C8E5" />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Pressable>
    </Box>
  )
}

export default memo(HotspotListItem)
