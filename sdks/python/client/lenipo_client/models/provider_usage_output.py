from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.module_name import ModuleName
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.provider_limits_output import ProviderLimitsOutput





T = TypeVar("T", bound="ProviderUsageOutput")



@_attrs_define
class ProviderUsageOutput:
    """ 
        Attributes:
            persons (int):
            agents (int):
            storage_mb (float):
            service_desks (int):
            modules (list[ModuleName]):
            limits (None | ProviderLimitsOutput):
            last_active_at (datetime.datetime | None):
            measured_at (datetime.datetime):
     """

    persons: int
    agents: int
    storage_mb: float
    service_desks: int
    modules: list[ModuleName]
    limits: None | ProviderLimitsOutput
    last_active_at: datetime.datetime | None
    measured_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.provider_limits_output import ProviderLimitsOutput # noqa: PLC0415
        persons = self.persons

        agents = self.agents

        storage_mb = self.storage_mb

        service_desks = self.service_desks

        modules = []
        for modules_item_data in self.modules:
            modules_item = modules_item_data.value
            modules.append(modules_item)



        limits: dict[str, Any] | None
        if isinstance(self.limits, ProviderLimitsOutput):
            limits = self.limits.to_dict()
        else:
            limits = self.limits

        last_active_at: None | str
        if isinstance(self.last_active_at, datetime.datetime):
            last_active_at = self.last_active_at.isoformat()
        else:
            last_active_at = self.last_active_at

        measured_at = self.measured_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "persons": persons,
            "agents": agents,
            "storageMb": storage_mb,
            "serviceDesks": service_desks,
            "modules": modules,
            "limits": limits,
            "lastActiveAt": last_active_at,
            "measuredAt": measured_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.provider_limits_output import ProviderLimitsOutput # noqa: PLC0415
        d = dict(src_dict)
        persons = d.pop("persons")

        agents = d.pop("agents")

        storage_mb = d.pop("storageMb")

        service_desks = d.pop("serviceDesks")

        modules = []
        _modules = d.pop("modules")
        for modules_item_data in (_modules):
            modules_item = ModuleName(modules_item_data)



            modules.append(modules_item)


        def _parse_limits(data: object) -> None | ProviderLimitsOutput:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                limits_type_0 = ProviderLimitsOutput.from_dict(data)



                return limits_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ProviderLimitsOutput, data)

        limits = _parse_limits(d.pop("limits"))


        def _parse_last_active_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_active_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_active_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_active_at = _parse_last_active_at(d.pop("lastActiveAt"))


        measured_at = datetime.datetime.fromisoformat(d.pop("measuredAt"))




        provider_usage_output = cls(
            persons=persons,
            agents=agents,
            storage_mb=storage_mb,
            service_desks=service_desks,
            modules=modules,
            limits=limits,
            last_active_at=last_active_at,
            measured_at=measured_at,
        )

        return provider_usage_output

