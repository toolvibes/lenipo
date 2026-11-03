from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.app_summary_modules import AppSummaryModules





T = TypeVar("T", bound="AppSummary")



@_attrs_define
class AppSummary:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            vendor (str):
            origin (str):
            uses_api (bool):
            modules (AppSummaryModules):
     """

    id: UUID
    key: str
    name: str
    vendor: str
    origin: str
    uses_api: bool
    modules: AppSummaryModules





    def to_dict(self) -> dict[str, Any]:
        from ..models.app_summary_modules import AppSummaryModules # noqa: PLC0415
        id = str(self.id)

        key = self.key

        name = self.name

        vendor = self.vendor

        origin = self.origin

        uses_api = self.uses_api

        modules = self.modules.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "vendor": vendor,
            "origin": origin,
            "usesApi": uses_api,
            "modules": modules,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.app_summary_modules import AppSummaryModules # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        vendor = d.pop("vendor")

        origin = d.pop("origin")

        uses_api = d.pop("usesApi")

        modules = AppSummaryModules.from_dict(d.pop("modules"))




        app_summary = cls(
            id=id,
            key=key,
            name=name,
            vendor=vendor,
            origin=origin,
            uses_api=uses_api,
            modules=modules,
        )

        return app_summary

