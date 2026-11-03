from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.module_name import ModuleName
from typing import cast






T = TypeVar("T", bound="ProviderLimitsOutput")



@_attrs_define
class ProviderLimitsOutput:
    """ 
        Attributes:
            plan (str):  Default: ''.
            persons (int | None):
            agents (int | None):
            storage_mb (int | None):
            modules (list[ModuleName] | None):
            service_desk (bool):  Default: True.
     """

    persons: int | None
    agents: int | None
    storage_mb: int | None
    modules: list[ModuleName] | None
    plan: str = ''
    service_desk: bool = True





    def to_dict(self) -> dict[str, Any]:
        plan = self.plan

        persons: int | None
        persons = self.persons

        agents: int | None
        agents = self.agents

        storage_mb: int | None
        storage_mb = self.storage_mb

        modules: list[str] | None
        if isinstance(self.modules, list):
            modules = []
            for modules_type_0_item_data in self.modules:
                modules_type_0_item = modules_type_0_item_data.value
                modules.append(modules_type_0_item)


        else:
            modules = self.modules

        service_desk = self.service_desk


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "plan": plan,
            "persons": persons,
            "agents": agents,
            "storageMb": storage_mb,
            "modules": modules,
            "serviceDesk": service_desk,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        plan = d.pop("plan")

        def _parse_persons(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        persons = _parse_persons(d.pop("persons"))


        def _parse_agents(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        agents = _parse_agents(d.pop("agents"))


        def _parse_storage_mb(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        storage_mb = _parse_storage_mb(d.pop("storageMb"))


        def _parse_modules(data: object) -> list[ModuleName] | None:
            if data is None:
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
            return cast(list[ModuleName] | None, data)

        modules = _parse_modules(d.pop("modules"))


        service_desk = d.pop("serviceDesk")

        provider_limits_output = cls(
            plan=plan,
            persons=persons,
            agents=agents,
            storage_mb=storage_mb,
            modules=modules,
            service_desk=service_desk,
        )

        return provider_limits_output

