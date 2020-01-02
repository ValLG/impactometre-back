'use strict'

const getClosest = require('../../utils/get-closest')
const ComponentDamage = require('./ComponentDamage')
const meetingEnums = require('../../constants/meeting')
const networkDatabase = require('../database/meeting/network')

class Software {
  constructor (software) {
    this._french = software.french
    this._fileSize = software.fileSize
    this._bandwith = software.bandwith
  }

  // Getter

  /**
   * Getter for software french name.
   */
  get french () {
    return this._french
  }

  /**
   * Getter for software file size.
   */
  get fileSize () {
    return this._fileSize
  }

  get bandwith () {
    return this._bandwith
  }

  // Setters

  /**
   * Setter of software french name.
   * @param french - The new software french name.
   */
  set french (newFrench) {
    this._french = newFrench
  }

  /**
   * Setter for software file size.
   */
  set fileSize (fileSize) {
    this._fileSize = fileSize
  }

  /**
   * Setter for software bandwith.
   */
  set bandwith (bandwith) {
    this._bandwith = bandwith
  }

  // Others methods

  /**
   * Get the software file size in bits (it is originaly in Mo)
   */
  fileSizeMoToBits () {
    return this.fileSize * meetingEnums.bitsInOctet * meetingEnums.octetsInMo
  }

  /**
 * Return the given software download speed.
 * @param {String} softwareName - The software name.
 * @param {Number} participantsNumber - The participants number.
 * @param {String} bound - The bound ('minimum' or 'ideal').
 */
  getInboundBandwith (participantsNumber, bound) {
    const rawInbound = this.bandwith.inbound

    /* If we don't have data specific to a number of
    participants, we return the unique value we got */
    if (typeof rawInbound === 'number') {
      return rawInbound
    }

    /* Among the available download speed values, we get the
    one which participants number is the closest from the
    given participants number.
    */
    const availableNumbers = Object.keys(rawInbound)
    const closestAvailableNumber = getClosest(
      participantsNumber,
      availableNumbers
    )

    const closestValue = this.bandwith.inbound[closestAvailableNumber]

    /* If we don't have bound specific data,
    we return the unique value we got */
    if (typeof closestValue === 'number') {
      return closestValue
    }

    /* If desired bound value was given, we return
    the corresponding value. Else we return the
    ideal value.
    */
    const boundSpecificValue = (bound != null)
      ? closestValue[bound]
      : closestValue.ideal

    return boundSpecificValue
  }

  /**
   * Returns the damage values (in damageUnit/bit) corresponding to network energetic intensity upper or lower bound.
   * It returns the upper bound value by default.
   * @param {string} networkBound - The network bound ('upper' or 'lower').
   * @returns the damage values (in damageUnit/bit) corresponding to network energetic intensity upper or lower bound.
   */
  static getNetworkEnergeticIntensity (networkBound) {
    let networkEnergeticIntensity

    if (networkBound === meetingEnums.networkEnergeticIntensityBound.LOWER) {
      networkEnergeticIntensity = networkDatabase.NETWORK_ENERGETIC_INTENSITY_LOWER.operatingOneBit
    } else {
      networkEnergeticIntensity = networkDatabase.NETWORK_ENERGETIC_INTENSITY_UPPER.operatingOneBit
    }

    return networkEnergeticIntensity
  }

  /**
   * Computes the software usage damage.
   * @param {Integer} instancesNumber - The number of software instances used for the meeting.
   * @param {String} bandwithBound - The bandwith bound ('minimum' or 'ideal').
   * @param {String} networkBound - The network bound ('upper' or 'lower').
   * @param {Number} meetingDuration - The meeting duration in minutes.
   * @returns {ComponentDamage} The dammage cauded by one minute's use of the software.
   */
  computeOperatingDamage (instancesNumber, bandwithBound, networkBound, meetingDuration) {
    // Initialize the new operating damage
    const operatingDamage = new ComponentDamage()

    // If the software has no inboud bandwith in the database, we return an empty damage
    if (!this.bandwith) return operatingDamage

    // We get the inboundBandwith (in Kbit/s)
    const inboundBandwith = this.getInboundBandwith(instancesNumber, bandwithBound)

    // We get the network energetic intensity (in damageUnit/bit)
    const networkEnergeticIntensity = new ComponentDamage(Software.getNetworkEnergeticIntensity(networkBound))

    // We compute the total damage for each damage shere (in damageUnit)
    Object.keys(operatingDamage).map((categoryDamage) =>{
      // (damageUnit/bit) * (Kbit/s) = 1000 * (damageUnit/s)
      operatingDamage[categoryDamage] = networkEnergeticIntensity[categoryDamage] * inboundBandwith 
      // (1000 * (damageUnit/s)) / 1000 = damageUnit/s
      operatingDamage[categoryDamage] /= meetingEnums.bitsInKbits
      // (damageUnit/s) * 60 = damageUnit/minute
      operatingDamage[categoryDamage] *= meetingEnums.secoundsInMinute
      // Damage for one minute use for all the instances
      operatingDamage[categoryDamage] *= instancesNumber
      // Damage for all the meeting
      operatingDamage[categoryDamage] *= meetingDuration
    })

    // Return the computed operating damage
    return operatingDamage
  }

  /**
   * Compute the download software damage.
   * @param {Integer} instancesNumber - The number of software instances used for the meeting.
   * @param {string} networkBound - The network bound ('upper' or 'lower').
   * @returns {ComponentDamage} The damage caused by all the software dowloads of the meeting.
   */
  computeEmbodiedDamage (instancesNumber, networkBound) {
    // Initialize the embodied damage
   const embodiedDamage = new ComponentDamage()

    // If there is no file to download or if there is no file size,
    // we return an empty damage.
    if (!this.fileSize) return embodiedDamage

    // We get the network energetic intensity (in damageUnit/bit)
    const networkEnergeticIntensity = new ComponentDamage(Software.getNetworkEnergeticIntensity(networkBound))

    // We get the file size in bits
    const fileSize = this.fileSizeMoToBits()

    // We compute the total damage for each damage shere (in damageUnit)
    Object.keys(embodiedDamage).map((categoryDamage) =>{
      embodiedDamage[categoryDamage] = networkEnergeticIntensity[categoryDamage] * fileSize * instancesNumber
    })

    // Return the computed embodied damage
    return embodiedDamage
  }
}

module.exports = Software
