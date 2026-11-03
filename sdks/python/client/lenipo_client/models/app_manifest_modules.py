from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.app_module import AppModule





T = TypeVar("T", bound="AppManifestModules")



@_attrs_define
class AppManifestModules:
    """ 
        Attributes:
            issue_panels (list[AppModule] | Unset):
            macros (list[AppModule] | Unset):
            gadgets (list[AppModule] | Unset):
     """

    issue_panels: list[AppModule] | Unset = UNSET
    macros: list[AppModule] | Unset = UNSET
    gadgets: list[AppModule] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.app_module import AppModule # noqa: PLC0415
        issue_panels: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.issue_panels, Unset):
            issue_panels = []
            for issue_panels_item_data in self.issue_panels:
                issue_panels_item = issue_panels_item_data.to_dict()
                issue_panels.append(issue_panels_item)



        macros: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.macros, Unset):
            macros = []
            for macros_item_data in self.macros:
                macros_item = macros_item_data.to_dict()
                macros.append(macros_item)



        gadgets: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.gadgets, Unset):
            gadgets = []
            for gadgets_item_data in self.gadgets:
                gadgets_item = gadgets_item_data.to_dict()
                gadgets.append(gadgets_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if issue_panels is not UNSET:
            field_dict["issuePanels"] = issue_panels
        if macros is not UNSET:
            field_dict["macros"] = macros
        if gadgets is not UNSET:
            field_dict["gadgets"] = gadgets

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.app_module import AppModule # noqa: PLC0415
        d = dict(src_dict)
        _issue_panels = d.pop("issuePanels", UNSET)
        issue_panels: list[AppModule] | Unset = UNSET
        if _issue_panels is not UNSET:
            issue_panels = []
            for issue_panels_item_data in _issue_panels:
                issue_panels_item = AppModule.from_dict(issue_panels_item_data)



                issue_panels.append(issue_panels_item)


        _macros = d.pop("macros", UNSET)
        macros: list[AppModule] | Unset = UNSET
        if _macros is not UNSET:
            macros = []
            for macros_item_data in _macros:
                macros_item = AppModule.from_dict(macros_item_data)



                macros.append(macros_item)


        _gadgets = d.pop("gadgets", UNSET)
        gadgets: list[AppModule] | Unset = UNSET
        if _gadgets is not UNSET:
            gadgets = []
            for gadgets_item_data in _gadgets:
                gadgets_item = AppModule.from_dict(gadgets_item_data)



                gadgets.append(gadgets_item)


        app_manifest_modules = cls(
            issue_panels=issue_panels,
            macros=macros,
            gadgets=gadgets,
        )

        return app_manifest_modules

