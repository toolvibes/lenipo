from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.page_watch_state_inherited_type_0 import PageWatchStateInheritedType0
from typing import cast






T = TypeVar("T", bound="PageWatchState")



@_attrs_define
class PageWatchState:
    """ 
        Attributes:
            page (bool):
            subtree (bool):
            inherited (None | PageWatchStateInheritedType0):
     """

    page: bool
    subtree: bool
    inherited: None | PageWatchStateInheritedType0





    def to_dict(self) -> dict[str, Any]:
        page = self.page

        subtree = self.subtree

        inherited: None | str
        if isinstance(self.inherited, PageWatchStateInheritedType0):
            inherited = self.inherited.value
        else:
            inherited = self.inherited


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "page": page,
            "subtree": subtree,
            "inherited": inherited,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        page = d.pop("page")

        subtree = d.pop("subtree")

        def _parse_inherited(data: object) -> None | PageWatchStateInheritedType0:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                inherited_type_0 = PageWatchStateInheritedType0(data)



                return inherited_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PageWatchStateInheritedType0, data)

        inherited = _parse_inherited(d.pop("inherited"))


        page_watch_state = cls(
            page=page,
            subtree=subtree,
            inherited=inherited,
        )

        return page_watch_state

