from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.module_name import ModuleName
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.provider_limits_requests_per_minute_type_0 import ProviderLimitsRequestsPerMinuteType0





T = TypeVar("T", bound="ProviderLimits")



@_attrs_define
class ProviderLimits:
    """ 
        Attributes:
            plan (str | Unset):  Default: ''.
            persons (int | None | Unset):
            agents (int | None | Unset):
            storage_mb (int | None | Unset):
            modules (list[ModuleName] | None | Unset):
            service_desk (bool | Unset):  Default: True.
            requests_per_minute (None | ProviderLimitsRequestsPerMinuteType0 | Unset):
            support_url (None | str | Unset):
     """

    plan: str | Unset = ''
    persons: int | None | Unset = UNSET
    agents: int | None | Unset = UNSET
    storage_mb: int | None | Unset = UNSET
    modules: list[ModuleName] | None | Unset = UNSET
    service_desk: bool | Unset = True
    requests_per_minute: None | ProviderLimitsRequestsPerMinuteType0 | Unset = UNSET
    support_url: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.provider_limits_requests_per_minute_type_0 import ProviderLimitsRequestsPerMinuteType0 # noqa: PLC0415
        plan = self.plan

        persons: int | None | Unset
        if isinstance(self.persons, Unset):
            persons = UNSET
        else:
            persons = self.persons

        agents: int | None | Unset
        if isinstance(self.agents, Unset):
            agents = UNSET
        else:
            agents = self.agents

        storage_mb: int | None | Unset
        if isinstance(self.storage_mb, Unset):
            storage_mb = UNSET
        else:
            storage_mb = self.storage_mb

        modules: list[str] | None | Unset
        if isinstance(self.modules, Unset):
            modules = UNSET
        elif isinstance(self.modules, list):
            modules = []
            for modules_type_0_item_data in self.modules:
                modules_type_0_item = modules_type_0_item_data.value
                modules.append(modules_type_0_item)


        else:
            modules = self.modules

        service_desk = self.service_desk

        requests_per_minute: dict[str, Any] | None | Unset
        if isinstance(self.requests_per_minute, Unset):
            requests_per_minute = UNSET
        elif isinstance(self.requests_per_minute, ProviderLimitsRequestsPerMinuteType0):
            requests_per_minute = self.requests_per_minute.to_dict()
        else:
            requests_per_minute = self.requests_per_minute

        support_url: None | str | Unset
        if isinstance(self.support_url, Unset):
            support_url = UNSET
        else:
            support_url = self.support_url


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if plan is not UNSET:
            field_dict["plan"] = plan
        if persons is not UNSET:
            field_dict["persons"] = persons
        if agents is not UNSET:
            field_dict["agents"] = agents
        if storage_mb is not UNSET:
            field_dict["storageMb"] = storage_mb
        if modules is not UNSET:
            field_dict["modules"] = modules
        if service_desk is not UNSET:
            field_dict["serviceDesk"] = service_desk
        if requests_per_minute is not UNSET:
            field_dict["requestsPerMinute"] = requests_per_minute
        if support_url is not UNSET:
            field_dict["supportUrl"] = support_url

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.provider_limits_requests_per_minute_type_0 import ProviderLimitsRequestsPerMinuteType0 # noqa: PLC0415
        d = dict(src_dict)
        plan = d.pop("plan", UNSET)

        def _parse_persons(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        persons = _parse_persons(d.pop("persons", UNSET))


        def _parse_agents(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        agents = _parse_agents(d.pop("agents", UNSET))


        def _parse_storage_mb(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        storage_mb = _parse_storage_mb(d.pop("storageMb", UNSET))


        def _parse_modules(data: object) -> list[ModuleName] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                modules_type_0 = []
                _modules_type_0 = data
                for modules_type_0_item_data in (_modules_type_0):
                    modules_type_0_item = ModuleName(modules_type_0_item_data)



                    modules_type_0.append(modules_type_0_item)

                return modules_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[ModuleName] | None | Unset, data)

        modules = _parse_modules(d.pop("modules", UNSET))


        service_desk = d.pop("serviceDesk", UNSET)

        def _parse_requests_per_minute(data: object) -> None | ProviderLimitsRequestsPerMinuteType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                requests_per_minute_type_0 = ProviderLimitsRequestsPerMinuteType0.from_dict(data)



                return requests_per_minute_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ProviderLimitsRequestsPerMinuteType0 | Unset, data)

        requests_per_minute = _parse_requests_per_minute(d.pop("requestsPerMinute", UNSET))


        def _parse_support_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        support_url = _parse_support_url(d.pop("supportUrl", UNSET))


        provider_limits = cls(
            plan=plan,
            persons=persons,
            agents=agents,
            storage_mb=storage_mb,
            modules=modules,
            service_desk=service_desk,
            requests_per_minute=requests_per_minute,
            support_url=support_url,
        )


        provider_limits.additional_properties = d
        return provider_limits

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
