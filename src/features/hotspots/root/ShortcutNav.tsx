import React, {
  memo,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
} from 'react'
import Mask from '@assets/images/shortcutMask.svg'
import { FlatList } from 'react-native-gesture-handler'
import { Hotspot, Witness } from '@helium/http'
import { uniqBy, upperFirst } from 'lodash'
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import Globe from '@assets/images/globeShortcut.svg'
import Search from '@assets/images/searchShortcut.svg'
import Home from '@assets/images/homeShortcut.svg'
import Follow from '@assets/images/follow.svg'
import animalName from 'angry-purple-tiger'
import { wp } from '../../../utils/layout'
import Text from '../../../components/Text'
import { useColors, useSpacing } from '../../../theme/themeHooks'
import Box from '../../../components/Box'
import usePrevious from '../../../utils/usePrevious'
import TouchableOpacityBox from '../../../components/BSTouchableOpacityBox'

export const SHORTCUT_NAV_HEIGHT = 44
const ITEM_SIZE = 35
const ITEM_MARGIN = 's'

type Props = {
  ownedHotspots: Hotspot[]
  followedHotspots: Hotspot[]
  selectedItem: GlobalOpt | Hotspot | Witness
  onItemSelected: (item: GlobalOpt | Hotspot) => void
}
const GLOBAL_OPTS = ['explore', 'search', 'home'] as const
export type GlobalOpt = typeof GLOBAL_OPTS[number]

export const IS_GLOBAL_OPT = (
  item: GlobalOpt | Hotspot | Witness,
): item is GlobalOpt => typeof item === 'string'

type FollowedHotspot = Hotspot & { followed?: boolean }

const getItemId = (item: GlobalOpt | FollowedHotspot | Witness | Hotspot) =>
  IS_GLOBAL_OPT(item) ? item : item.address

const getAnimalName = (hotspot: Hotspot) => {
  const pieces = (hotspot.name || animalName(hotspot.address)).split('-')
  return pieces[pieces.length - 1]
}

const sortByName = (hotspots: Hotspot[]) =>
  hotspots.sort((l, r) => (getAnimalName(l) > getAnimalName(r) ? 1 : -1))

const ShortcutNav = ({
  ownedHotspots,
  followedHotspots,
  selectedItem: propsItem,
  onItemSelected,
}: Props) => {
  const colors = useColors()
  const spacing = useSpacing()
  const listRef = useRef<FlatList<Hotspot | Witness | GlobalOpt>>(null)
  const snapPos = useRef<number>(0)
  const hasFollowHotspotChange = useRef(false)
  const disableMomentumSnap = useRef(false)
  const scrollOffset = useRef(0)
  const [internalItem, setInternalItem] = useState({ index: 2, id: 'home' }) // start user at home
  const hasScrolledToHome = useRef(false)
  const optSize = ITEM_SIZE + spacing[ITEM_MARGIN]
  const prevFollowed = usePrevious(followedHotspots)
  const [sizes, setSizes] = useState(
    GLOBAL_OPTS.reduce(
      (obj, item) => ({ ...obj, [item]: optSize }),
      {} as Record<string, number | null>,
    ),
  )

  const ownerAddress = useMemo(
    () => (ownedHotspots.length ? ownedHotspots[0].owner : ''),
    [ownedHotspots],
  )

  const hotspots = useMemo(() => {
    // sort order
    // 1. Owned and Followed
    // 2. Followed
    // 3. Owned

    const uniqueHotspots = uniqBy(
      [
        ...followedHotspots.map((h) => ({ ...h, followed: true })),
        ...ownedHotspots,
      ],
      (h) => h.address,
    ) as FollowedHotspot[]

    const groupedHotspots = uniqueHotspots.reduce(
      (val, hotspot) => {
        if (!hotspot.followed) {
          return { ...val, owned: [...val.owned, hotspot] }
        }
        if (hotspot.owner === ownerAddress) {
          return {
            ...val,
            ownedAndFollowed: [...val.ownedAndFollowed, hotspot],
          }
        }
        return { ...val, followed: [...val.followed, hotspot] }
      },
      {
        ownedAndFollowed: [] as FollowedHotspot[],
        followed: [] as FollowedHotspot[],
        owned: [] as FollowedHotspot[],
      } as Record<'ownedAndFollowed' | 'followed' | 'owned', FollowedHotspot[]>,
    )

    return [
      ...sortByName(groupedHotspots.ownedAndFollowed),
      ...sortByName(groupedHotspots.followed),
      ...sortByName(groupedHotspots.owned),
    ]
  }, [followedHotspots, ownedHotspots, ownerAddress])

  const isSelected = useCallback(
    (
      item: GlobalOpt | Witness | Hotspot,
      selected: GlobalOpt | Witness | Hotspot,
    ) => {
      if (IS_GLOBAL_OPT(selected) && IS_GLOBAL_OPT(item)) {
        return selected === item
      }
      if (!IS_GLOBAL_OPT(selected) && !IS_GLOBAL_OPT(item)) {
        return selected.address === item.address
      }

      return false
    },
    [],
  )

  const data = useMemo(() => {
    return [...GLOBAL_OPTS, ...hotspots]
  }, [hotspots])

  const handleLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const item = data[index]
      if (IS_GLOBAL_OPT(item)) return

      const { width } = event.nativeEvent.layout
      setSizes((s) => ({ ...s, [item.address]: width }))
    },
    [data],
  )

  const scrollOffsets = useMemo(
    () =>
      data.reduce((total, item, index) => {
        let offset = 0
        if (index === 0) return [offset]

        if (index < GLOBAL_OPTS.length) {
          offset = index * (ITEM_SIZE + spacing[ITEM_MARGIN])
        } else if (!IS_GLOBAL_OPT(item)) {
          if (index === GLOBAL_OPTS.length) {
            offset =
              2.5 * ITEM_SIZE +
              3 * spacing[ITEM_MARGIN] +
              (sizes[item.address] || 0) / 2
          } else {
            let sizeKey = ''
            const prevItem = data[index - 1]
            if (IS_GLOBAL_OPT(prevItem)) {
              sizeKey = prevItem
            } else {
              sizeKey = prevItem.address
            }
            offset =
              total[index - 1] +
              (sizes[item.address] || 0) / 2 +
              (sizes[sizeKey] || 0) / 2 +
              spacing[ITEM_MARGIN]
          }
        }

        return [...total, offset || 0]
      }, [] as number[]),
    [data, sizes, spacing],
  )

  const scroll = useCallback(
    (index: number, animated = true) => {
      disableMomentumSnap.current = true
      let offset = 0
      if (index >= 0) {
        offset = scrollOffsets[index]
      }

      if (scrollOffset.current === offset) {
        // Don't scroll, if you're already there
        return
      }
      listRef.current?.scrollToOffset({ offset, animated })
    },
    [scrollOffsets],
  )

  useEffect(() => {
    // Scroll to home when component first mounts
    if (hasScrolledToHome.current || Object.keys(sizes).length < data.length)
      return

    hasScrolledToHome.current = true
    scroll(2, true)
  }, [data.length, scroll, sizes])

  useEffect(() => {
    if (getItemId(propsItem) === internalItem.id) {
      return
    }

    const index = data.findIndex(
      (item) => getItemId(item) === getItemId(propsItem),
    )

    if (index === -1) return

    // The selected item was changed from the outside world
    // Track it and scroll to it
    setInternalItem({
      index,
      id: getItemId(propsItem),
    })

    scroll(index)
  }, [data, scroll, propsItem, internalItem.id])

  const handleItemSelected = useCallback(
    (item: GlobalOpt | Hotspot) => {
      if (getItemId(item) === getItemId(propsItem)) {
        return
      }
      setInternalItem({
        index: data.indexOf(item),
        id: getItemId(item),
      })
      onItemSelected(item)
    },
    [data, onItemSelected, propsItem],
  )

  useEffect(() => {
    // if there's a newly followed hotspot, wait for sizes to update then scroll to it
    if (!hasFollowHotspotChange.current) return

    const allSizesFound = data.every((d) => !!sizes[getItemId(d)])
    if (!allSizesFound) return

    const nextIndex = data.findIndex((d) => isSelected(d, propsItem))
    if (nextIndex === -1) return

    hasFollowHotspotChange.current = false
    scroll(nextIndex)
  }, [data, isSelected, scroll, propsItem, sizes])

  useEffect(() => {
    if (prevFollowed && followedHotspots.length !== prevFollowed.length) {
      // remove this item from the size list
      if (internalItem.index >= GLOBAL_OPTS.length && propsItem) {
        sizes[getItemId(propsItem)] = null
      }

      if (followedHotspots.length < prevFollowed.length) {
        // a hotspot has been unfollowed, snap to nearest pill
        const maxIndex = data.length - 1
        const nextIndex = Math.min(maxIndex, internalItem.index)
        handleItemSelected(data[nextIndex])
      }

      hasFollowHotspotChange.current = true
    }
  }, [
    data,
    followedHotspots.length,
    handleItemSelected,
    isSelected,
    prevFollowed,
    propsItem,
    internalItem,
    sizes,
  ])

  const handlePress = useCallback(
    (item: GlobalOpt | Hotspot) => async () => {
      handleItemSelected(item)
      scroll(data.findIndex((d) => isSelected(d, item)))
    },
    [data, handleItemSelected, isSelected, scroll],
  )

  const backgroundColor = useCallback(
    (item: FollowedHotspot, selected: boolean) => {
      if (item.owner === ownerAddress) {
        return selected ? 'blueBright' : 'blueBright60'
      }
      return selected ? 'purpleBright' : 'purpleBright60'
    },
    [ownerAddress],
  )

  const renderHotspot = useCallback(
    (item: FollowedHotspot, index: number) => {
      if (!item.name) return null

      const selected = isSelected(item, propsItem)
      const [, , animal] = item.name.split('-')

      return (
        <TouchableOpacityBox
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          backgroundColor={backgroundColor(item, selected)}
          onLayout={handleLayout(index)}
          onPress={handlePress(item)}
          borderRadius="round"
          marginRight={ITEM_MARGIN}
          height={ITEM_SIZE}
          flexDirection="row"
          paddingHorizontal="m"
          alignItems="center"
        >
          <Box paddingRight="xs">
            {item.followed && (
              <Follow height={12} width={12} color={colors.primaryBackground} />
            )}
          </Box>
          <Text
            variant="medium"
            fontSize={16}
            color="purpleDark"
            maxFontSizeMultiplier={1}
          >
            {upperFirst(animal)}
          </Text>
        </TouchableOpacityBox>
      )
    },
    [
      backgroundColor,
      colors.primaryBackground,
      handleLayout,
      handlePress,
      isSelected,
      propsItem,
    ],
  )

  const renderGlobalOpt = useCallback(
    (item: GlobalOpt) => {
      const selected = isSelected(item, propsItem)

      const getIcon = () => {
        const color = () => {
          if (selected) {
            return colors.purpleDark
          }
          return colors.purpleBrightMuted
        }
        switch (item) {
          case 'home':
            return <Home color={color()} />
          case 'explore':
            return <Globe color={color()} />
          case 'search':
            return <Search color={color()} />
        }
      }
      return (
        <TouchableOpacityBox
          alignItems="center"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onPress={handlePress(item)}
          justifyContent="center"
          borderRadius="round"
          width={ITEM_SIZE}
          height={ITEM_SIZE}
          marginRight={ITEM_MARGIN}
          backgroundColor={selected ? 'white' : 'purpleDarkMuted'}
        >
          {getIcon()}
        </TouchableOpacityBox>
      )
    },
    [colors, handlePress, isSelected, propsItem],
  )

  type ListItem = { item: Hotspot | GlobalOpt; index: number }
  const renderItem = useCallback(
    ({ item, index }: ListItem) => {
      if (IS_GLOBAL_OPT(item)) {
        return renderGlobalOpt(item as GlobalOpt)
      }
      return renderHotspot(item, index)
    },
    [renderGlobalOpt, renderHotspot],
  )

  const keyExtractor = useCallback((item: GlobalOpt | Hotspot) => {
    if (IS_GLOBAL_OPT(item)) {
      return item
    }
    return item.address
  }, [])

  const contentContainerStyle = useMemo(() => {
    const paddingStart = wp(50) - ITEM_SIZE / 2
    const lastItem = data[data.length - 1]
    let lastItemWidth = ITEM_SIZE
    if (!IS_GLOBAL_OPT(lastItem) && sizes[lastItem.address]) {
      lastItemWidth = sizes[lastItem.address] || 0
    }
    const paddingEnd = wp(50) - lastItemWidth / 2
    return { paddingStart, paddingEnd }
  }, [data, sizes])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.x
    },
    [],
  )

  const handleScrollMomentum = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (disableMomentumSnap.current) return

      let snapIndex = 0
      const scrolledOffset = event.nativeEvent.contentOffset.x

      let highIndex = scrollOffsets.findIndex(
        (offset) => offset > scrolledOffset,
      )
      if (highIndex === -1) {
        // couldn't find an offset larger than scrolled position
        // snap to last position
        highIndex = scrollOffsets.length - 1
      }

      if (highIndex > 0) {
        const lowIndex = highIndex - 1
        const lowDiff = scrolledOffset - scrollOffsets[lowIndex]
        const highDiff = scrollOffsets[highIndex] - scrolledOffset
        snapIndex = lowDiff < highDiff ? lowIndex : highIndex
      }
      const nextItem = data[snapIndex]
      const nextPos = scrollOffsets[snapIndex]

      if (nextItem === propsItem) return

      snapPos.current = nextPos
      handleItemSelected(nextItem)
    },
    [data, handleItemSelected, scrollOffsets, propsItem],
  )

  const handleBeginDrag = useCallback(() => {
    disableMomentumSnap.current = false
  }, [])

  return (
    <Box height={SHORTCUT_NAV_HEIGHT} backgroundColor="primaryBackground">
      <Box top={-43} left={0} right={0} height={43} position="absolute">
        <Mask width="100%" color={colors.primaryBackground} />
      </Box>
      <FlatList
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore This warning is a bug with react-native-gesture-handle
        ref={listRef}
        showsHorizontalScrollIndicator={false}
        horizontal
        data={data}
        contentContainerStyle={contentContainerStyle}
        initialNumToRender={10000} // Need all pills to render in order to avoid snap jank
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onScroll={handleScroll}
        onScrollBeginDrag={handleBeginDrag}
        onMomentumScrollEnd={handleScrollMomentum}
        snapToOffsets={scrollOffsets}
        decelerationRate="fast"
      />
    </Box>
  )
}

export default memo(ShortcutNav)
