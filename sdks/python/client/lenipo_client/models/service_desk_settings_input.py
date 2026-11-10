from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.service_desk_settings_input_customer_access import ServiceDeskSettingsInputCustomerAccess
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.service_desk_settings_input_first_response_hours import ServiceDeskSettingsInputFirstResponseHours
  from ..models.service_desk_settings_input_resolution_hours import ServiceDeskSettingsInputResolutionHours





T = TypeVar("T", bound="ServiceDeskSettingsInput")



@_attrs_define
class ServiceDeskSettingsInput:
    """ 
        Attributes:
            customer_access (ServiceDeskSettingsInputCustomerAccess):
            intro (str):
            first_response_hours (ServiceDeskSettingsInputFirstResponseHours):
            resolution_hours (ServiceDeskSettingsInputResolutionHours):
            pause_status_ids (list[UUID]):
            time_zone (str):
            day_start_hour (int):
            accept_unknown_senders (bool | Unset):  Default: False.
            allowed_domains (list[str] | Unset):
     """

    customer_access: ServiceDeskSettingsInputCustomerAccess
    intro: str
    first_response_hours: ServiceDeskSettingsInputFirstResponseHours
    resolution_hours: ServiceDeskSettingsInputResolutionHours
    pause_status_ids: list[UUID]
    time_zone: str
    day_start_hour: int
    accept_unknown_senders: bool | Unset = False
    allowed_domains: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.service_desk_settings_input_first_response_hours import ServiceDeskSettingsInputFirstResponseHours # noqa: PLC0415
        from ..models.service_desk_settings_input_resolution_hours import ServiceDeskSettingsInputResolutionHours # noqa: PLC0415
        customer_access = self.customer_access.value

        intro = self.intro

        first_response_hours = self.first_response_hours.to_dict()

        resolution_hours = self.resolution_hours.to_dict()

        pause_status_ids = []
        for pause_status_ids_item_data in self.pause_status_ids:
            pause_status_ids_item = str(pause_status_ids_item_data)
            pause_status_ids.append(pause_status_ids_item)



        time_zone = self.time_zone

        day_start_hour = self.day_start_hour

        accept_unknown_senders = self.accept_unknown_senders

        allowed_domains: list[str] | Unset = UNSET
        if not isinstance(self.allowed_domains, Unset):
            allowed_domains = self.allowed_domains




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "customerAccess": customer_access,
            "intro": intro,
            "firstResponseHours": first_response_hours,
            "resolutionHours": resolution_hours,
            "pauseStatusIds": pause_status_ids,
            "timeZone": time_zone,
            "dayStartHour": day_start_hour,
        })
        if accept_unknown_senders is not UNSET:
            field_dict["acceptUnknownSenders"] = accept_unknown_senders
        if allowed_domains is not UNSET:
            field_dict["allowedDomains"] = allowed_domains

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.service_desk_settings_input_first_response_hours import ServiceDeskSettingsInputFirstResponseHours # noqa: PLC0415
        from ..models.service_desk_settings_input_resolution_hours import ServiceDeskSettingsInputResolutionHours # noqa: PLC0415
        d = dict(src_dict)
        customer_access = ServiceDeskSettingsInputCustomerAccess(d.pop("customerAccess"))




        intro = d.pop("intro")

        first_response_hours = ServiceDeskSettingsInputFirstResponseHours.from_dict(d.pop("firstResponseHours"))




        resolution_hours = ServiceDeskSettingsInputResolutionHours.from_dict(d.pop("resolutionHours"))




        pause_status_ids = []
        _pause_status_ids = d.pop("pauseStatusIds")
        for pause_status_ids_item_data in (_pause_status_ids):
            pause_status_ids_item = UUID(pause_status_ids_item_data)



            pause_status_ids.append(pause_status_ids_item)


        time_zone = d.pop("timeZone")

        day_start_hour = d.pop("dayStartHour")

        accept_unknown_senders = d.pop("acceptUnknownSenders", UNSET)

        allowed_domains = cast(list[str], d.pop("allowedDomains", UNSET))


        service_desk_settings_input = cls(
            customer_access=customer_access,
            intro=intro,
            first_response_hours=first_response_hours,
            resolution_hours=resolution_hours,
            pause_status_ids=pause_status_ids,
            time_zone=time_zone,
            day_start_hour=day_start_hour,
            accept_unknown_senders=accept_unknown_senders,
            allowed_domains=allowed_domains,
        )


        service_desk_settings_input.additional_properties = d
        return service_desk_settings_input

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
