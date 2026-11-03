from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast

if TYPE_CHECKING:
  from ..models.diff_block_content import DiffBlockContent
  from ..models.word_change import WordChange





T = TypeVar("T", bound="DiffBlockType1")



@_attrs_define
class DiffBlockType1:
    """ 
        Attributes:
            op (Literal['changed']):
            before (DiffBlockContent):
            after (DiffBlockContent):
            words (list[WordChange]):
     """

    op: Literal['changed']
    before: DiffBlockContent
    after: DiffBlockContent
    words: list[WordChange]





    def to_dict(self) -> dict[str, Any]:
        from ..models.diff_block_content import DiffBlockContent # noqa: PLC0415
        from ..models.word_change import WordChange # noqa: PLC0415
        op = self.op

        before = self.before.to_dict()

        after = self.after.to_dict()

        words = []
        for words_item_data in self.words:
            words_item = words_item_data.to_dict()
            words.append(words_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "op": op,
            "before": before,
            "after": after,
            "words": words,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.diff_block_content import DiffBlockContent # noqa: PLC0415
        from ..models.word_change import WordChange # noqa: PLC0415
        d = dict(src_dict)
        op = cast(Literal['changed'] , d.pop("op"))
        if op != 'changed':
            raise ValueError(f"op must match const 'changed', got '{op}'")

        before = DiffBlockContent.from_dict(d.pop("before"))




        after = DiffBlockContent.from_dict(d.pop("after"))




        words = []
        _words = d.pop("words")
        for words_item_data in (_words):
            words_item = WordChange.from_dict(words_item_data)



            words.append(words_item)


        diff_block_type_1 = cls(
            op=op,
            before=before,
            after=after,
            words=words,
        )

        return diff_block_type_1

