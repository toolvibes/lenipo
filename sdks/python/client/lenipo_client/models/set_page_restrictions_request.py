from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.set_page_restrictions_request_edit import SetPageRestrictionsRequestEdit
  from ..models.set_page_restrictions_request_view import SetPageRestrictionsRequestView





T = TypeVar("T", bound="SetPageRestrictionsRequest")



@_attrs_define
class SetPageRestrictionsRequest:
    """ 
        Attributes:
            view (SetPageRestrictionsRequestView):
            edit (SetPageRestrictionsRequestEdit):
     """

    view: SetPageRestrictionsRequestView
    edit: SetPageRestrictionsRequestEdit
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.set_page_restrictions_request_edit import SetPageRestrictionsRequestEdit # noqa: PLC0415
        from ..models.set_page_restrictions_request_view import SetPageRestrictionsRequestView # noqa: PLC0415
        view = self.view.to_dict()

        edit = self.edit.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "view": view,
            "edit": edit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.set_page_restrictions_request_edit import SetPageRestrictionsRequestEdit # noqa: PLC0415
        from ..models.set_page_restrictions_request_view import SetPageRestrictionsRequestView # noqa: PLC0415
        d = dict(src_dict)
        view = SetPageRestrictionsRequestView.from_dict(d.pop("view"))




        edit = SetPageRestrictionsRequestEdit.from_dict(d.pop("edit"))




        set_page_restrictions_request = cls(
            view=view,
            edit=edit,
        )


        set_page_restrictions_request.additional_properties = d
        return set_page_restrictions_request

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
